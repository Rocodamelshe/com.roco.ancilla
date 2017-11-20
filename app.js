'use strict';

const Homey = require('homey');
const dateformat = require('dateformat');
var FeedMe = require('feedme');
var http = require('http');
var https = require('https');
var urllist = []; //array with {name,url,latestbroadcast,latesturl,token} feeds from settings
var data = [];
var total = 0
var tokenval 
var refreshIntervalId
var statusplay
let triggercard

class Ancilla extends Homey.App {	
	onInit() {
		this.log('Ancilla starting');
		
		triggercard = new Homey.FlowCardTrigger('new_ancilla_pic');
		triggercard.register();
			
		let stopPlayAction = new Homey.FlowCardAction('stop_play');
			stopPlayAction
				.register()
				.registerRunListener(( args, state ) => {
					clearInterval(refreshIntervalId)
					statusplay = false
					let isStopped = true; // true or false
					return Promise.resolve( isStopped );
				});

		let startPlayAction = new Homey.FlowCardAction('start_play');
			startPlayAction
				.register()
				.registerRunListener(( args, state ) => {
					var pauze = args.pauze;
					if (statusplay = true) {
						clearInterval(refreshIntervalId)
					}
					play(pauze);
					statusplay = true
					let isStarted = true; // true or false
					return Promise.resolve( isStarted );
				});
				
		tokenval = new Homey.FlowToken( 'Ancilla', {
				type: 'string',
				title: 'Ancilla'
			});
		tokenval.register()
				.then(() => {
				return tokenval.setValue( "https://i.pinimg.com/236x/5b/3d/7b/5b3d7be42d2c8917e17e8a03eaf1a4ff--ancilla-tilia.jpg" );
				})
		
		//const rssurl = "https://www.pinterest.co.uk/stof3/ancilla-tilia.rss/";
		//const rssurl = "https://backend.deviantart.com/rss.xml?q=gallery%3AAncillaTilia%2F7290048&type=deviation";
		//const rssurl = "https://nl.pinterest.com/elturix80/ancilla-tilia.rss/";
		const rssurl = "http://ancilliatiliacurves.tumblr.com/rss";
		readfeeds(rssurl).then(function(results) {
			urllist=results;
			total = urllist[0].tracks.length;
			console.log("start playing");
			console.log("number of items: ", total);
		})


		
	}
}

function play (pauze) {

	//create one big array of urls
	data = []
	for (var i = 0, len = urllist[0].tracks.length; i < len; i++) {
		var item = urllist[0].tracks[i].description
		item.replace(/</g,'&lt;').replace(/>/g,'&gt;')
		//var patt = /<img.*?src="([^">]*\/([^">]*?))".*?>/g;
		// var patt = /\<img.+src\=(?:\"|\')(.+?)(?:\"|\')(?:.+?)\>/
		var patt = /src="([^"]+)"/g
		//var currImage = patt.exec(item);
		var c2 = item.match(patt);
		console.log(c2)
		for (var j = 0, len2 = c2.length; j < len2; j++) {
			var turl = c2[j].substring(5,c2[j].length-1)
			var tobj = {'item': turl, 'tijd': urllist[0].tracks[i].release_date, 'pctitle': urllist[0].tracks[i].title};
			data.push(tobj)
		}
	}
	console.log ("data is lang: ", data.length)
	
	var total = data.length;
	var counter = 0;	
	refreshIntervalId = setInterval(() => {
		if (counter > total-1) { counter = 0; }
		console.log (counter)
		console.log (data[counter])
		tokenval.setValue(data[counter].item);
		triggercard.trigger(data[counter]);
		counter = counter+1;
	}, pauze * 1000);
}

async function readfeeds(rssurl) {
		var temparray = [];
		var item = await readfeed(rssurl);
		temparray.push (item);
		return temparray;
};
	
function readfeed(url) {
	return new Promise(resolve => {
			http.get(url, function(res) {
				var parser = new FeedMe(true);
				var teller=0;
				
				/*
				parser.on('item', (item) => {
					if (teller === 0) { //only on first item
						var objIndex = urllist.findIndex((obj => obj.url == url));
						console.log(objIndex);
						if (urllist[objIndex].latestbroadcast != null) { //already a latest url in tag
							var oldtimestamp = urllist[objIndex].latestbroadcast;
							var oldurl=urllist[objIndex].latesturl;
							var newtimestamp = Date.parse(item.pubdate)/1000;
							if (newtimestamp > oldtimestamp) { //new item
								urllist[objIndex].latestbroadcast = newtimestamp
								urllist[objIndex].token.setValue(item.enclosure.url);
								urllist[objIndex].latesturl = item.enclosure.url;
								
								//here a trigger should be fired
								let tokens = {
									'item': item.enclosure.url,
									'tijd': item.pubdate,
									'vctitle': urllist[objIndex].name,
								}
								console.log(tokens);
								//console.log(urllist[objIndex].flowTriggers.newvodcast);
								urllist[objIndex].flowTriggers.newvodcast.trigger(tokens).catch( this.error );
								
								
							} else {
								//no new item
							}
						} else { //set first url in tag
							urllist[objIndex].token.setValue(item.enclosure.url);						
							urllist[objIndex].latesturl = item.enclosure.url;
							urllist[objIndex].latestbroadcast = Date.parse(item.pubdate)/1000;
						}
						teller=teller+1; //only first item
					};	
				});
				*/				
				res.pipe(parser);			

				parser.on('end', function() {
					var pl = parser.done();
					var result = {
						type: 'photolist',
						id: pl.title,
						title: pl.title,
						tracks: parseTracks(pl.items) || false,
					};
				resolve(result);
				});	
			});		
	});
};


	
	
function parseTracks(tracks) {
	const result = [];
	if (!tracks) {
		return result;
	}
	tracks.forEach((track) => {
		const parsedTrack = parseTrack(track);
		if (parsedTrack !== null) {
			parsedTrack.confidence = 0.5;
			result.push(parsedTrack);
		}
	});
	return result;
}

function parseTrack(track) {
	return {
		type: 'track',
		id: track.guid,
		title: track.title,
		description: track.description,
		release_date: dateformat(track.pubdate, "yyyy-mm-dd"),
	}
}

function hmsToSecondsOnly(str) {
	if (str != null) {
		//console.log(str);
    var p = str.split(':'),
        s = 0, m = 1;
    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }
	s=s*1000
	//console.log(s);
	} else {s=null}
    return s;
}

module.exports = Ancilla;