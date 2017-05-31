'use strict' // to make JavaScript less forgiving

/* Dependencies */
var IdGenerator = require("./../helpers/IdGenerator.js"); // unique user id generator ./../ means cd out of the current folder
var FileSystem = require("./../helpers/FileSystem.js"); // unique file system for the user ./../ means cd out of the current folder
var bcrypt = require("bcrypt"); // password encryption module 
var fs = require("fs"); // used to manipulate the file system 
var Database = require("./../helpers/Database.js"); // ./../ means cd out of the current folder

var ActiveUsers = require("./../models/ActiveUsers.js"); // ActiveUsers model imported
var Users = require("./../models/Users.js"); // Users model imported
var Trashes = require("./../models/Trashes.js"); // Trashes model imported

/* Constants */
const SALT = 10; // salt for the bcrypt password hashing
const FSPATH = "./filesystems/user-fs/"; 

/*
	
	NOTE** - there is no ./../ in path variables because it is only required when requiring a module from the directory,
			 since everything gets assembled by the file called app.js, everything is in relative to the
			 path that app.js exists in, therefore you don't need to cd out of the folder, only when require specific
			 modules you need to cd out, as requiring a module happens when you are relative to the path that the file
			 that is requiring the module is located at						

*/

// Main controller class

class DriveController {
	
	constructor() {
		// generate the database for every single user registered in the system
		this.database = new Database();
		this.database.generate();
		this.modelAU = new ActiveUsers(); // composition relationship with the ActiveUsers model which is a collection
		this.modelU = new Users(); // composition relationship with the Users model which is a collection
		this.modelT = new Trashes(); // composition relationship with the Trashes model which is a collection
	}

	intro() {
		console.log("Server is listening on port 3000...");
	}

	index(req, res) {
		res.status(200).render("index");
	}

	authenticate(req, res) {
		var self = this; // this keyword is different within different scopes
		var genObj = new IdGenerator();

		if (req.body.which === "#login") { // handles login
			this.modelU.query(req.body.username, function(doc) {
				// black box, and is an abstraction that I am willing to accept
				// when comes to how bcrypt module handles its security and authentication
				// the result is magically formulated by bcrypt to chec whether the password
				// provided by the user is correct or not				
				bcrypt.compare(req.body.password, doc.password, function(err, result) {
					if (result === true) {
						var responseObj = {};
						responseObj.id = doc.id;
						res.status(200).send(responseObj);
					} else { 
						res.status(200).send("login-password-error"); // 0 means not a success
					}
				});
			}, function() { res.status(200).send("loging-name-error"); }); // when user cannot be found in the database
	
		} else { // handles registration
			// object which will hold the user details to be added to the database
			var userDetails = {}; 

			// query mongoDb Users collection with the request body's username
			this.modelU.query(req.body.username, function() {
				// if a document exists with the name provided we know that its a problem
				res.status(200).send("0");

			}, function() {
				bcrypt.genSalt(SALT, function(err, salt) {
					bcrypt.hash(req.body.password, salt, function(err, hash) {
						userDetails.password = hash;
						if (req.body.username !== "") {
							userDetails.id = genObj.generateId(req.body.username);
							// user registered and inserted to the database
							self.modelU.insert(userDetails, function() {
								console.log("User registered");
							});
							// the file system folder needs to be created for individual users
							// each user has their own folder
							fs.mkdir(FSPATH + req.body.username, function(err) {
								if (err) console.log("Error in creating directory...");
								else console.log("Directory called " + req.body.username + " created");
							});
							// added to the static database of users, NOTE** - on initial registration the user's FSTree is empty
							self.database.add(req.body.username);
							// this function body is the last thing that gets executed in this funciton body
							res.status(200).send("registration-success");
						} else {
							res.status(200).send("registration-failure");
						}
					});
				});
				// asynchronousity allows this to run first and this gets used within the nested scope
				userDetails.name = req.body.username;
			});
		}
	}

	redirect(req, res) {
		this.modelAU.insert(req.body.name, function() {
			res.sendStatus(200);
		}, function() {
			res.status(200).send("404");
		});
	}

	nameCheck(req, res) {
		this.modelU.query(req.body.val, function() {
			res.status(200).send("0"); // if it is found in the database then red light
		}, function() { 
			res.status(200).send("1"); // if the name is not found in the data base then green light
		});
	}

	// renders a new page depending on the name of the user hence the route
	// "/:username means that the route is dynamic depending on whatever is being sent!"
	username(req, res) {
		// to obtain the dynamic url aliased by :username we can directly access the url
		// aliased by this by using the syntax req.params.username
		this.modelAU.query(req.params.username, function() {
			res.status(200).render("drive", {name: req.params.username});
		}, function() { res.status(200).render("404"); });

	}

	// Check mongodb if the active user is pressed, if they are from the database (facade class)
	// grab the users file system, ls it using the path sent to you through the route and then
	// send the array back by putting it inside a json object.
	init(req, res) {
		var self = this;
		this.modelAU.query(req.params.username, function() {
			// retrieve the file system of the user from the facade class
			var userFS = self.database.retrieve(req.params.username);
			// retrieve the array from the tree encapsulated inside the users file system
			var ls = userFS.listDirectoryContents(req.body.path);
			// create the response object
			var responseObj = {};
			// encapsulate the directory contents array inside the response object
			responseObj.ls = ls;
			// send the response objet
			res.status(200).send(responseObj);
		}, function() { res.status(200).render("404"); });
	}

	uploadFiles(req, res) {
		var self = this;
		// check for the username provided is found in the collection of active users in the database
		this.modelAU.query(req.params.username, function() {
			var bytes = "";
			// bytes being send in as chunks that get stored inside the bytes variable asynchronously
			req.on("data", function(chunk) {
				bytes += chunk;
			});
			req.on("end", function() {
				var requestObj = JSON.parse(bytes); // a string object is being sent which represents a JSON object, so parsiing it to the JSON object is required
				
				// retrieve the user' file system
				var userFS = self.database.retrieve(req.params.username);
				
				// file uploaded and saved to file system
				userFS.uploadFile(requestObj);

				res.sendStatus(200);

			});
		}, function() { res.status(200).render("404"); });

	}

	// the instructions to create a folder is being sent from the client side
	// "/:username means that the route is dynamic depending on whatever is being sent!"
	uploadFolders(req, res) {
		var self = this;
		// to obtain the dynamic url's variable aliased by :username we can directly access it
		// using req.params.username

		// searches the Mongodb TinDrive database in the active users collection for the username that is
		// contained in the part of the url
		this.modelAU.query(req.params.username, function() {
			// we have found a user by the name of req.params.username in the database for ActiveUsers collections!
			// make the folder with the specific path provided through the request object which 
			// represents a folder						
			// retrieve the file system of the user from the facade class
			var userFS = self.database.retrieve(req.params.username);
			// delegate the responsibilities to the userFS
			userFS.uploadFolder(req.body);
			res.sendStatus(200);						
		}, function() { res.status(200).render("404"); });
	}

	// when doubleclick is made on the client side on a folder
	expandDir(req, res) {
		// this keyword is different for each function scope, so we make a variable point to this within
		// the current function scope's this	
		var self = this; 

		// Mongodb needs to be checked for the current client that is trying to communicate
		// with the db has gone through the authentication process or not

		this.modelAU.query(req.params.username, function() {
			// retrieve the userFS using the facade class
			var userFS = self.database.retrieve(req.params.username);

			// retrieve the list of contents in a particular directory
			var ls = userFS.listDirectoryContents(req.body.path);

			// encapsulate the diretory contents in a response object
			var responseObj = {};
			responseObj.ls = ls;

			// send the responseObject back
			res.status(200).send(responseObj);

		}, function() { res.status(200).render("404"); });
	}

	// when the back space is pressed on the client side
	back(req, res) {
		// the keyword this is varies between scopes, we make a variable which points to the this within the scope so that it can be used within nested scope inside the function
		var self = this; 
		/*
			TinDrive's ActiveUsers collection needs to be checked for the user who is trying to communicate
			with the server, if the user is not in the Active connection we refuse to give information back
			only through legit authentication can the user access information
		*/
		this.modelAU.query(req.params.username, function() {
			// retrieve the user's file system using the facade class-- database
			var userFS = self.database.retrieve(req.params.username);

			// retrieve the list of contents in a particular directory
			var ls = userFS.listDirectoryContents(req.body.path);

			// encapsulates the directory contents in a response object
			var responseObj = {};
			responseObj.ls = ls;

			// send the response object black
			res.status(200).send(responseObj);

		}, function() { res.status(200).render("404"); });

	}

	// when the user presses the delete button with a bunch of selected files
	trash(req, res) {
		var self = this; // this key word has different meanings in different scopes
		// query the active users database to check the username from the req.params is active or not
		this.modelAU.query(req.params.username, function() {
			/* THIS IS JUST A TEST UNDO THIS AND IMLEMENT THIS LATER */
			
			// succes in finding the user in the database
		
			// retrieve the user's file system object using the username
			var userFS = self.database.retrieve(req.params.username);

			// Either file or folder, both their paths will be the same, which is req.body.path
			// as req.body.path is the path of the container folder containing either the folder or file.
			var content = userFS.trash(req.body); // we return the content (file or folder) which we will use and insert to the database

			if (content) { // if and only if content exists we add it to the MongoDB database

				// query() method of modelT object will take three parameters, the name, a successcall back and the failure call back
				self.modelT.query(req.params.username, function(doc) {

					if (doc === null) {
						// if doc is null it means that the object we were looking for in the mongo db collection couldn't be found
						
						// object created to store the user's name and the directory of files or folders that are trashed
						// since its the first time we are deleting a file or folder we need to create the objects which represents
						// a directory of trashed files and folders
						var userTrashedDir = {};

						// Add the name of the user to the object as an attribute to the object, because each object needs 
						// to be identified using the name when the query method of the modelT is called. Each user will
						// have their own individual trash folder and to access it the user's name should be used as an identifier.
						userTrashedDir.name = req.params.username;

						// trashedDir is the attribute which stores the files or folders with their trashed boolean set to true
						userTrashedDir.trashedDir = [];

						// push the folder or file object that we just deleted into the trashedDir array
						userTrashedDir.trashedDir.push(content); 

						// upsert the created object into the Trashed collection for that individual user
						self.modelT.upsert(userTrashedDir);

						console.log("Trashed directory for the user " + req.params.username + " created...");

					} else {
						// if doc is not null that means doc has successfully returned the object that we were looking for and we can now
						// successfully update the object that we found

						// we access the trashedDir attribute from the object retrieved from mongodb
						var trashedDir = doc.trashedDir;

						// push the folder or file object that we just deleted into the trashedDir array
						trashedDir.push(content);

						// we create the new updated object which will be used to be updated back into mongodb
						var newUserTrashedDir = {};
						newUserTrashedDir.name = doc.name;
						newUserTrashedDir.trashedDir = trashedDir;

						// now with the new trashedDir array filled with more deleted objects we insert it back into the mongodb, by updating our prexisting object
						self.modelT.upsert(newUserTrashedDir);

						console.log("Trashed directory for the user " + req.params.username + " updated...");

					}

					
					res.sendStatus(200); // successCallBack should always return a positive response
					
				}, function() { res.status(200).render("404"); }); // failureCallBack should always return a 404 page

			}

		}, function() {
			// failure to find the user in the database
			res.status(200).render("404");
		});

	}



	logout(req, res) {
		this.modelAU.remove(req.body.name, function() { 
			res.sendStatus(200); 
		}, function() { 
			res.status(200).render("404"); 
		});
	}

	// on 404 errors
	err(req, res) { res.status(200).render("404"); }

}


module.exports = DriveController;