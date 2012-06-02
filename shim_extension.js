(function () {
	var console={}; console.log=function(){};
	(typeof chrome === 'undefined') && (chrome = {});
	(typeof chrome.extension === 'undefined') && (chrome.extension = {});
	(typeof chrome.tabs === 'undefined') && (chrome.tabs = {});

	var dest = window.parent,
	     extension_origin = '*',//change chrome-extension:// value later
	     cached_callbacks={},
	     chrome_extension_request_callbacks=[],
	     callbackID = 0,
	     chrome_tabs_updated_callbacks=[];

	chrome.tabs.getCurrent = function(callback){
		console.log("LOW: need to getCurrent Tab and run callback on it");
		var callbackctr = -1;
		if(typeof callback !== 'undefined'){
			callbackctr = callbackID++;
			cached_callbacks[callbackctr] = callback;
		}
		var temp = {"type":"chrome.tabs.getCurrent","callbackid":callbackctr};
		dest.postMessage(temp,extension_origin);
	};		

	chrome.tabs.remove = function (tabid,callback){
		console.log("LOW: need to remove tab",tabid," and run callback");
		var callbackctr = -1;
		if(typeof callback !== 'undefined'){
			callbackctr = callbackID++;
			cached_callbacks[callbackctr] = callback;
		}
		var temp = {"type":"chrome.tabs.remove","callbackid":callbackctr,"tabid":tabid};
		dest.postMessage(temp,extension_origin);
	};
			
	chrome.tabs.create = function (createProperties,callback){
		console.log("LOW: need to create tab and run callback on it");
		var callbackctr=-1;
		if(typeof callback !== 'undefined'){
			callbackctr = callbackID++;
			cached_callbacks[callbackctr] = callback;
		}
		var temp = {"type":"chrome.tabs.create","callbackid":callbackctr,"createProperties":createProperties};
		dest.postMessage(temp,extension_origin);
	};		


        (typeof chrome.tabs.onUpdated === 'undefined') && (chrome.tabs.onUpdated = {});
	chrome.tabs.onUpdated.addListener = function(lambda){
		chrome_tabs_updated_callbacks.push(lambda);
	};

	chrome.extension.sendRequest = function(msg){ //FIXME needs further refining for correct API
		//console.log("LOW: need to send",msg);		
		var temp = {"type":"chrome.extension.sendRequest","request":msg};
		dest.postMessage(temp,extension_origin);
	};
	
	chrome_extension_request_callbacks=[];
	(typeof chrome.extension.onRequest === 'undefined') && (chrome.extension.onRequest = {});

	chrome.extension.onRequest.addListener = function(lambda){
		chrome_extension_request_callbacks.push(lambda);
	};
	
	var onMessage = function(event){
		//add origin check
		var msg = event.data, cb_id;
		if(msg.type==='ev_chrome.tabs.onrequest'){
			console.log("LOW: received request for ",msg.request);
			chrome_extension_request_callbacks.map(function(lambda){lambda.call(window,msg.request);});
		}

		if(msg.type==='cb_chrome.tabs.getCurrent'){
			console.log("LOW: received response for getCurrent",msg.callbackid);
			cb_id = msg.callbackid;
			if(cb_id !== -1){
			cached_callbacks[cb_id].call(window,msg.tab);
			delete cached_callbacks[cb_id];
			}
		}

		if(msg.type==='cb_chrome.tabs.create'){
			console.log("LOW: received response for create",msg.callbackid);
			cb_id = msg.callbackid;
			if(cb_id !== -1){
			cached_callbacks[cb_id].call(window,msg.tab);
			delete cached_callbacks[cb_id];
			}
		}

		if(msg.type==='ev_chrome.tabs.onUpdated'){
			//tabid,changeinfo,tab
			console.log("LOW: received tab updated notifcation for ",msg);
			chrome_tabs_updated_callbacks.map(function(lambda){lambda.call(window,msg.tabid,msg.changeinfo,msg.tab);});
		}

		
		if(msg.type==='cb_chrome.tabs.remove'){
		//	console.log("LOW: received response for remove",msg.callbackid);
			cb_id = msg.callbackid;
			if(cb_id !== -1){
			cached_callbacks[cb_id].call(window);
			delete cached_callbacks[cb_id];
			}
		}

		if(msg.type === 'cb_xhr.onreadystatechange'){
			console.log("Recvd callback for",msg.id);
			cached_callbacks[msg.id].call(window,{readyState:msg.readyState,responseText:msg.responseText,status:msg.status});
		}	

		if(msg.type === 'cb_worker.onmessage'){
			console.log("Recvd callback for worker",msg.id);
			cached_callbacks[msg.id].call(window,{'event':msg.event});
		}


	};

	window.addEventListener('message',onMessage);

/* FIXME Need to proxy window.addEventListener 
and save calls to 'message' event and make sure that
they are forwarded if the msg doesn't match our code */

XMLHttpRequest = function(){
//	console.log("xhr constructor called");
	var xhrid= callbackID++;
	var that = this;
	dest.postMessage({'type':'xhr_new','id':xhrid},extension_origin);
	this.open= function(method,url,async,user,password){
//			console.log("making request for",method,url,async,"id is",xhrid);
			if(async ===false){
				throw "Do not support synchronous XHR inside sandbox";
			}
			var temp ={'type':'xhr_open','method':method,'url':url,'async':async,
				'user':user,'password':password,'id':xhrid};
			dest.postMessage(temp,extension_origin);
			};

	this.send= function(body){
//			console.log("id:",xhrid," sending request");
			dest.postMessage({type:'xhr_send','body':body,'id':xhrid},extension_origin);
		    };
	
	this.setRequestHeader = function(header,value){
					dest.postMessage({'id':xhrid,'type':'xhr_setRequestHeader',
							  'header': header,'value':value},extension_origin);
				};

	Object.defineProperties(this, {
		"onreadystatechange" : {
			"set" : function(lambda){
//					console.log("saving",xhrid,lambda);
					if(lambda.toString().indexOf("[native code]") >= 0){
					}
					cached_callbacks[xhrid]=function(params){
						//console.log("callback xhr: ",xhrid,params);
						that.readyState = params.readyState;
						that.responseText = params.responseText;
						that.status = params.status;
						console.log(xhrid,"calling ",lambda);
						lambda.call(that);
						   };
					}
				     }
                                 } 
                             );
	

	

	};


	
_Worker = function(srcfile){
	console.log("worker constructor called for",srcfile);
	var workerid= callbackID++;
	var that = this;
	var sentSignal = false;
	dest.postMessage({'type':'worker_new','id':workerid,'srcfile':srcfile},extension_origin);


	this.postMessage = function(msg){
		console.log("sending msg for id",workerid," val",msg);
		dest.postMessage({'type':'worker_postMessage','id':workerid,'msg':msg},extension_origin);
		sentSignal = true;
	};

	this.terminate = function(){
		console.log("sending terminate msg for worker id",workerid);
		dest.postMessage({'type':'worker_terminate','id':workerid},extension_origin);
	};

	Object.defineProperties(this, 
		{
		"onmessage" : {
			"set" : function(lambda){
					console.log("setting callback",lambda);
					cached_callbacks[workerid]=function(params){
						//console.log(workerid," worker onmessage event calling ",lambda);
						lambda.call(that,params.event);
					};

					if(sentSignal === false){
						dest.postMessage({'type':'worker_callback_set','id':workerid},extension_origin);
						sentSignal=true;
					}
				
                                }
			     }
                } );
	

	

	};


'';//need this before doing the shorthand below, else interpreted as a call
(typeof webkitNotifications === 'undefined') && (webkitNotifications = {});
webkitNotifications.createNotification = function(iconUrl,title,body){
						var notificationid = callbackID++;
						
						return {
							'show' : function(){
								dest.postMessage({
								'type':'notification_show',
								'iconUrl':iconUrl,
								'title':title,
								'body':body,
								'id':notificationid},extension_origin);},

							'cancel' :function(){ dest.postMessage({
								'type':'notification_cancel',
								'id':notificationid},extension_origin);}
							};
					};

			

var Storage = function (type) {
   var saveToMainCache = function (data){
	console.log("saving: ",data);
	if(type==='local'){
	dest.postMessage({"type":"localStorage_save","value":data},extension_origin);
	}
   }


  var data = {};

  // initialise if there's already data
   if(type ==='local' && typeof window._localStorageCache !== 'undefined' ){
	data = window._localStorageCache;
	delete window._localStorageCache;
   }

  return {
    length: 0,
    clear: function () {
      data = {};
      this.length = 0;
      saveToMainCache(data);
      //clearData();
    },
    getItem: function (key) {
      console.log(type+"getting: ",key,data[key]);
      return data[key] === undefined ? null : data[key];
    },
    key: function (i) {
      // not perfect, but works
      var ctr = 0;
      for (var k in data) {
        if (ctr == i) return k;
        else ctr++;
      }
      return null;
    },
    removeItem: function (key) {
      console.log(type+"removing: ",key);
      delete data[key];
      this.length--;
      saveToMainCache(data);
      //setData(data);
    },
    setItem: function (key, value) {

      data[key] = value+''; // forces the value to a string
      console.log(type+"setting: ",key,"to",value," data is ",data);
      this.length++;
      saveToMainCache(data);
      //setData(data);
    }
  };
};

window._localStorage = new Storage('local');
//console.log("created window._localStorage");
//window.sessionStorage = new Storage('session');


})();
