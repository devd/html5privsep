var setupSandbox=function(params){
	var h_untrusted;
    //this is hardcoded for now, can be easily fixed
  (typeof params.base === 'undefined') && (params.base = 'http://localhost/sqlbuddy/');
  (typeof params.url === 'undefined') && (params.url= 'index.php');
   var base = params.base;
(function(){
var cached_xhr_objects={};
var policy = {
  allowcall : function(msg){
    if(!(msg.type === 'xhr_new' ||
         msg.type === 'xhr_open' ||
         msg.type === 'xhr_setRequestHeader' ||
         msg.type === 'xhr_send' ||
         msg.type === 'window.location.hash.set')){return false;}

    if(msg.type === 'xhr_open' &&
      msg.url.match(/^[a-z]+\.php(\?.+)?$/) === null){
        return false;
      }
    return true;
  }
};

var sendToLow = function(msg){
	if(typeof h_untrusted === 'undefined'){ return;}
	if(typeof msg === 'object'){
	h_untrusted.postMessage(msg,'*');
	}
    };



var handle_messages = function(event){
	if(event.origin !== 'null'){ return;}
	var msg = event.data;
    if(!(policy.allowcall(msg))){return;}
	switch(msg.type){
	case 'xhr_new'		:       cached_xhr_objects[msg.id] = new XMLHttpRequest(); 
					break;
	case 'xhr_open'	: 	
					msg.url = base+msg.url;
					cached_xhr_objects[msg.id].open(msg.method,msg.url,msg.async,msg.user,msg.password);
					//console.log("making XHR request",msg.id," to",msg.url);
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
  case 'window.location.hash.set' : window.location.hash=msg.value;break;
	}
};



window.addEventListener('message',handle_messages);
})();

(function(){
var req = new XMLHttpRequest();
req.open("GET",params.url,false);
req.send(null);

content = "<html><head><base href='"+params.base+"'><script src='shim.js' type='text/javascript' ><"+"/script>"+req.responseText;
content=encodeURIComponent(content);
var fr = document.createElement("iframe");
fr.setAttribute("frameBorder","0");
fr.setAttribute("height","100%");
fr.setAttribute("id","mainframe");
fr.src="data:text/html,"+content;
document.body.appendChild(fr);
h_untrusted = fr.contentWindow;
})();
};
