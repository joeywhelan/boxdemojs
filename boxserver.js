/**
 * This code implements the basics of the box.com REST API using node.js
 * 
 * Author: Joey Whelan
 *
 */
var fs = require('fs');
var https = require('https');
var express = require('express');
var async = require('async');
var querystring = require('querystring');
var appHttps = express();

/**
 * SSL properties.  HTTPS is mandatory for the redirect URL during the OAuth 2.0 handshake with box.com
 */
var privateKey = fs.readFileSync('./localkey.pem');
var certificate = fs.readFileSync('./localcert.pem');
var credentials = {key: privateKey, cert: certificate};
var httpsServer = https.createServer(credentials, appHttps);

httpsServer.listen(3443);
appHttps.use(express.logger());
appHttps.engine('html', require('ejs').renderFile);
console.log('Listening on port 3443');

// Displays initial authorization page to initiate the OAuth 2.0 handshake
appHttps.get('/boxdemo', 
		function(req, res)
		{
			res.render('auth.html');
			//res.send(200, fs.readFileSync('./auth.html'));  //Step 1, have user pass your app client_id to box.com
		});


// Receives OAuth 'code', initiates request for OAuth token, displays box.com folder content of user's account
appHttps.get('/boxdemo/redirect', 
		function(req, res)
		{
			if (req.query.code !== undefined)  //OAuth 'code' was granted
			{   
				async.waterfall(		//'Synchronous' set of steps to work thru the OAuth handshakes
						[
				              function (callback)   //Step 2.  Swap the OAuth code for a 'token'
				              {
				            	 console.log("Entering Step 2");
				            	 var postData = querystring.stringify({  //Set up query params for the body of the POST request
				            		 'grant_type' : 'authorization_code',
				            		 'code' : req.query.code,
				            		 'client_id' : 'yourid',
				            		 'client_secret' : 'yoursecret',
				            		 'redirect_uri' : 'youruri'
				            	 });
				            	 
				            	 var options = {
				            			 host: 'www.box.com',
				            			 port: '443',
				            			 path: '/api/oauth2/token/',
				            			 method: 'POST',
				            			 headers: {
				            			          'Content-Type': 'application/x-www-form-urlencoded',
				            			          'Content-Length': postData.length
				            			      }
				            	 };
				            	 
				            	 var retData = '';
				            	 var postReq = https.request(options, function(res){
				            		 			res.on('data', function(chunk){
				            		 				retData += chunk;
				            		 			});
				            		 			res.on('end', function() {
				            		 				var obj = JSON.parse(retData);  //Parse out the OAuth token
				            		 				callback(null, obj.access_token);  //Send token to next function in waterfall
				            		 			});
				            		 
				            	 });
				            	 
				            	 postReq.write(postData);  //Write query params to body
				            	 postReq.on('error', function(err) { callback(err); });
				            	 postReq.end();
				            	 console.log("Exiting Step 2");
				              },
				              function (token, callback)  //Step 3.  Invoke box.com API with the token from Step 2.  In this case, simple display of files
				              {
				            	 console.log('Entering Step 3');
				            	  var options = {
					            			 host: 'api.box.com',
					            			 port: '443',
					            			 path: '/2.0/folders/0/items',
					            			 method: 'GET',
					            			 headers: {'Authorization' : 'Bearer ' + token}  //token obtained from Step 2
				            	  };
				            	  var retData='';
				            	  var getReq = https.request(options, function(res){
		            		 			res.on('data', function(chunk){
		            		 				retData += chunk;
		            		 			});
		            		 			res.on('end', function() {
		            		 				callback(null, retData);  //Send returned data to next function in waterfall
		            		 			});
				            	  });
				            	  
		            		 	  getReq.on('error', function(err) { callback(err); });
						          getReq.end();
						          console.log('Exiting Step 3');
				              },
				              function (fileData, callback)
				              {
				            	  console.log('Entering Step 4');
				            	  res.send(200, fileData);  //return the raw JSON dump of the file metadata obtained from box.com 
				            	  callback(null);
				            	  console.log('Exiting Step 4');
				              }
				        ],
				        function(err)
				        {
							if (err)
							{
								console.log('Error: ' + err.message);
								res.send(400, err.message);
							}
				        }
				);
				
			}
			else  //OAuth 'code' wasn't granted, likely due to user not passing authentication to box.com
				if (req.query.error !== undefined)
					retVal = req.query.error + ':' + req.query.error_description;
		});
