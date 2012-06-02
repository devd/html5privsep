(function () {

	var dest = window.parent,
	     extension_origin = '*',//change chrome-extension:// value later
	     cached_callbacks={},
	     callbackID = 0;

	var onMessage = function(event){
		//add origin check
		var msg = event.data, cb_id;

		if(msg.type === 'cb_xhr.onreadystatechange'){
			//console.log("Recvd callback for",msg.id);
			cached_callbacks[msg.id].call(window,{readyState:msg.readyState,responseText:msg.responseText,status:msg.status});
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
//					if(lambda.toString().indexOf("[native code]") >= 0){}
					cached_callbacks[xhrid]=function(params){
						//console.log("callback xhr: ",xhrid,params);
						that.readyState = params.readyState;
						that.responseText = params.responseText;
						that.status = params.status;
						//console.log(xhrid,"calling ",lambda);
						lambda.call(that);
						   };
					}
				     }
                                 } 
                             );
	

	

	};


(typeof window.location === 'undefined') && (window.location = {});

var fakeHashStorage="";

Object.defineProperties(window.location,{
    "hash": {
        "set" : function(newHash){
                  dest.postMessage({'type':'window.location.hash.set',
                                    'value':newHash},extension_origin);
                  if(newHash.indexOf('#')!==0){newHash='#'+newHash;}
                  fakeHashStorage=newHash;
               },
         "get" : function(){ return fakeHashStorage;}
      }
      });
                  

})();
