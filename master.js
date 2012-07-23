var setupSandbox = function(params){

	var h_untrusted;

(function(){

  var policy = {
    allowcall : function(){return true;}
  };

var cached_xhr_objects={};
var cached_worker_objects={};
var cached_notification_objects={};

var sendToLow = function(msg){
	if(typeof h_untrusted === 'undefined'){return;}
	if(typeof msg === 'object'){
	h_untrusted.postMessage(msg,'*');
	 }
	};

chrome.extension.onRequest.addListener(function(request,sender,sendResponse){
	//code to forward it
	console.log("HIGH: forwarding ",request);
	sendToLow({"type":"ev_chrome.tabs.onrequest","request":request});
  });


chrome.tabs.onUpdated.addListener(function(tabid,changeinfo,tab){
	//FIXME: code for sendResponse
//	console.log("HIGH: tab updated ",arguments);
	sendToLow({"type":"ev_chrome.tabs.onUpdated",
		   "tabid":tabid,"changeinfo":changeinfo,"tab":tab});
  });


var handle_messages = function(event){
	if(event.origin !== 'null'){ return;}
	var msg = event.data;
    if(!policy.allowCall(msg)){return;}
	
	switch(msg.type){

	case 'chrome.extension.sendRequest' : chrome.extension.sendRequest(msg.request);
					       break;

	case 'chrome.tabs.create' : //createProperties,callbackid
				     chrome.tabs.create(msg.createProperties,function(tab){
						
						sendToLow({"type":"cb_chrome.tabs.create","tab":tab,
							   "callbackid":msg.callbackid });
							});
				     break;

	case 'chrome.tabs.remove' : //tabid,callbackid
				     chrome.tabs.remove(msg.tabid,function(){
						sendToLow({"type":"cb_chrome.tabs.remove",
							   "callbackid":msg.callbackid });
							});
				     break;

	case 'chrome.tabs.getCurrent' : //callbackid
					chrome.tabs.getCurrent(function(tab){
						sendToLow({"type":"cb_chrome.tabs.getCurrent",
							    "callbackid":msg.callbackid,
							    "tab":tab});
						});
					 break;

	case 'xhr_new'		:       cached_xhr_objects[msg.id] = new XMLHttpRequest(); 
					break;
	case 'xhr_open'	: 	cached_xhr_objects[msg.id].open(msg.method,msg.url,msg.async,msg.user,msg.password);
					console.log("making XHR request",msg.id," to",msg.url);
					cached_xhr_objects[msg.id].onreadystatechange = function(event){
						if(cached_xhr_objects[msg.id].readyState !== 4){return;}
						var temp = {'readyState': cached_xhr_objects[msg.id].readyState,
							     'responseText': cached_xhr_objects[msg.id].responseText,
							     'type' : 'cb_xhr.onreadystatechange',
							     'status':cached_xhr_objects[msg.id].status,
							      'id': msg.id };
						sendToLow(temp);
						};
					break;
	case 'xhr_send'	:	if(typeof cached_xhr_objects[msg.id] === 'undefined'){ throw "Can't find object";}
					cached_xhr_objects[msg.id].send(msg.body || null); 
					break;

	case 'xhr_setRequestHeader' :	if(typeof cached_xhr_objects[msg.id] === 'undefined'){ throw "can't find object"; }
					cached_xhr_objects[msg.id].setRequestHeader(msg.header,msg.value);
					break;

	case 'localStorage_save' :	localStorage.setItem('_localStorageCache',JSON.stringify(msg.value));
					console.log("saved",localStorage.getItem('_localStorageCache'));
					break; 

	case 'worker_new'	:	cached_worker_objects[msg.id] = msg.srcfile;
					break;


	case 'worker_callback_set' 	: 
	case 'worker_postMessage'	: if(typeof cached_worker_objects[msg.id] === 'string'){
						console.log("creating new worker with src",cached_worker_objects[msg.id]);
						cached_worker_objects[msg.id] = new Worker(cached_worker_objects[msg.id]);
						cached_worker_objects[msg.id].onmessage = function(event){
							sendToLow({'type':'cb_worker.onmessage','id':msg.id,'event':{'origin':event.origin,'data':event.data}});
						}
					  }

					 if(typeof msg.msg === 'string'){console.log("sending msg to worker",msg.msg);cached_worker_objects[msg.id].postMessage(msg.msg);}
					 break;

	case 'worker_terminate'	: cached_worker_objects[msg.id].terminate(); delete cached_worker_objects[msg.id]; 
					  break;


	case 'notification_show'	: cached_notification_objects[msg.id] = webkitNotifications.createNotification(msg.iconUrl,msg.title,msg.body);
					  cached_notification_objects[msg.id].show();
					  break;

	case 'notification_cancel'	: cached_notification_objects[msg.id].cancel(); delete cached_notification_objects[msg.id]; 
					  break;

					

	}
	};
window.addEventListener('message',handle_messages);
})();

(function(){
if(typeof params.file !== 'string'){console.log("ERROR: setupSandbox called with no file",arguments); return;}
params.csp_policy = (typeof params.csp_policy === 'string') ? '<meta http-equiv="X-WebKit-CSP" content="'+params.csp_policy+'">' : "";
params.id = (typeof params.id === 'string' ) ? params.id:"";
params.basedir = (typeof params.basedir === 'string' ) ? params.basedir : "";
var req = new XMLHttpRequest();
req.open("GET",params.file,false);
req.send(null);
var base=chrome.extension.getURL(params.basedir);
var sb_content="<html><head>"+params.csp_policy+"<base href='"+base+"'>";
var  cache = localStorage.getItem('_localStorageCache');
if(cache !== null){
	sb_content=sb_content+"<script>window._localStorageCache = "+cache+"; </"+"script>";
}
sb_content=sb_content+req.responseText;
sb_content=encodeURIComponent(sb_content);
var fr = document.createElement("iframe");
fr.setAttribute("frameBorder","0");
fr.setAttribute("sandbox","allow-scripts allow-forms");
fr.setAttribute("height","100%");
fr.setAttribute("id",params.id);
fr.src="data:text/html,"+sb_content;
document.body.appendChild(fr);
h_untrusted = fr.contentWindow;
})();

};
