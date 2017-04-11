//janus websocket protocol
let jwsp={};
jwsp.session_id;
jwsp.transactions={};
jwsp.handle_ids={};
jwsp.connect=(ws_address)=>{
	return new Promise((resolve,rejsect)=>{
		ws=new WebSocket(ws_address,'janus-protocol');
		ws.onopen=()=>{
			resolve();
		};
		ws.onerror=(err)=>{
			let errmsg={
				janus:"error",
				error:{
					code:500,
					reason:err.stack
				}
			};
			reject(err);
		};
		ws.onmessage=(message)=>{
			console.log('[JANUS>BROWSER] MSG:'+message.data);
			let parsed=JSON.parse(message.data);
			let trx=jwsp.transactions[parsed.transaction];
			switch(parsed.janus){
				case "success":
					switch(trx.order){
						case "create":
							jwsp.session_id=parsed.data.id;
							break;
						case "attach":
							jwsp.handle_ids[trx.extra.plugin]=parsed.data.id;
							break;
						default:
					};
					trx.onsuccess();
					delete jwsp.transactions[parsed.transaction];
					break;
				case "error":
					trx.onerror(parsed.error);
					delete jwsp.transactions[parsed.transaction];
					break;
				case "event":
					if(trx) trx.onsuccess(parsed);
					delete jwsp.transactions[parsed.transaction];
					break;
				case "ack":
					switch(trx.order){
						case "message":
							//nothing to do
							break;
						default:
							delete jwsp.transactions[parsed.transaction];
					};
					break;
				default:
			};
		};
		jwsp.ws=ws;
	});
};
jwsp.trxid=()=>{
	let len=12;
	let charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let randomString='';
	for(let i=0;i<len;i++){
		let randomPoz = Math.floor(Math.random() * charSet.length);
		randomString += charSet.substring(randomPoz,randomPoz+1);
	};
	return randomString;
};
jwsp.create_session=()=>{
	return new Promise((resolve,reject)=>{
		let request = { 
			"janus": "create"
		};
		jwsp.sendMsg("create",request,resolve,reject);
	});
};
jwsp.attach_plugin=(plugin_name,opaque_id)=>{
	return new Promise((resolve,reject)=>{
		let request = { 
			"janus": "attach", 
			"opaqueId":opaque_id,
			"session_id":jwsp.session_id,
			"plugin":plugin_name
		};
		jwsp.sendMsg("attach",request,resolve,reject,{plugin:plugin_name});
	});
};
jwsp.sendMsg=(order,msg,on_success,on_error,extra)=>{
	let trxid=jwsp.trxid();
	msg.transaction=trxid;
	jwsp.transactions[trxid]={};
	jwsp.transactions[trxid].onsuccess=on_success;
	jwsp.transactions[trxid].onerror=on_error;
	jwsp.transactions[trxid].order=order;
	jwsp.transactions[trxid].extra=extra;
	console.log('[BROWSER>JANUS] MSG:'+JSON.stringify(msg));
	jwsp.ws.send(JSON.stringify(msg));
};
jwsp.start_keepalive=()=>{
	let request={
		janus:"keepalive",
		session_id:jwsp.session_id
	};
	jwsp.sendMsg("keepalive",request,()=>{},(err)=>{});
	setTimeout(jwsp.start_keepalive,30000);
};
jwsp.tricle=(candidate,plugin_name)=>{
	let s_candidate={ 
		"candidate":candidate.candidate, 
		"sdpMid":candidate.sdpMid, 
		"sdpMLineIndex":candidate.sdpMLineIndex
	};
	let request = { 
		"janus": "trickle",
		"session_id":jwsp.session_id,
		"handle_id":jwsp.handle_ids[plugin_name],
		"candidate":s_candidate
	};        
	jwsp.sendMsg("tricle",request);
};

//set functions for plugin
jwsp.plugin={};
jwsp.plugin.audiobridge={};
jwsp.plugin.audiobridge.join=(roomopt)=>{
	return new Promise((resolve,reject)=>{
		let request={};
		request.janus='message';
		request.session_id=jwsp.session_id;
		request.handle_id=jwsp.handle_ids['janus.plugin.audiobridge'];
		request.body={};
		request.body.request='join';
		request.body.room=roomopt.room;
		if(roomopt.id) request.body.id;
		if(roomopt.pin) request.body.pin;
		if(roomopt.display) request.body.display;
		if(roomopt.token) request.body.token;
		if(roomopt.muted) request.body.muted;
		if(roomopt.quality) request.body.quality;
		if(roomopt.volume) request.body.volume;
		jwsp.sendMsg("message",request,resolve,reject);
	});
};
jwsp.plugin.audiobridge.configure=(sdp)=>{
	return new Promise((resolve,reject)=>{
		let _jsep={
			type:sdp.type,
			sdp:sdp.sdp
		};
		let request={
			janus:'message',
			session_id:jwsp.session_id,
			handle_id:jwsp.handle_ids['janus.plugin.audiobridge'],
			body:{
				request:'configure',
				muted:false
			},
			jsep:_jsep
		};
		jwsp.sendMsg("message",request,resolve,reject);
	});
};
