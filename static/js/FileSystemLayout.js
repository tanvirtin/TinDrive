'use strict'; // to avoid JavaScript weirdness

// responsible for managing the #dnd div which is basically the drop box zone
// should contain some sort of data structure which allows it to keep a track
// of how the file system actually looks like, x and y axis value to place a 
// file, should be the main communicator with the user, and should have a 
// composition relationship with FileIcon and FolderIcon classes
class FileSystemLayout {

	constructor() {
		// should have x and y coordinates
		this.x = 15;
		this.y = 7;
		this.contents = []; // contains a collection of conents being added to the window can be a fileIcon or FolderIcon
		this.globalClick = false; // this keeps track of whether the drop zone click should make all the files blue or not, if it is true then
								  // then the counter will be incremented
		this.counter = 0;		 // only if the counter is greater than 0 the click event handler will loop through everything and unselect and selected file
							     // and turn the color of the file from red to blue
		this.dropZoneId = "#dnd"; // main focus variable
		this.keyStack = []; // a stack of event keys for creating a new folder
		this.path = new Path();
		// default route options, strings get added on top of this depending on
		// the situation to make ajax requests
		this.route = "/" + $("#username").text() + "/";
	}

	create() {
		this.generateInitialFS();
		this.attachGlobalClickEH();
		this.attachFolderEH();
	}

	generateInitialFS() {
		var self = this;
		// on creation of the file system layout we must make an ajax request to get the list
		// of files there is initially on the root folder, so that we can display the users

		var requestObj = {}
		requestObj.path = this.path.get;

		$.ajax({
			url: self.route + "init",
			type: "POST",
			data: requestObj,
			success: function(data) {
				for (var i = 0; i < data.ls.length; ++i) {
					if (data.ls[i].type === "file") {
						// if the content is a file then add file to DOM
						self.addFileToDOM(data.ls[i]);
					} else {
						// if the content is a folder then add the folder to DOM
						self.addFolderToDOM(data.ls[i].name);
					}
				}
			}
		})
	}

	addFileToDOM(fObj) {
		// a check to see if file with a similar name exists or not
		for (var i = 0; i < this.contents.length; ++i) {
			if (this.contents[i].name === fObj.name) {
				alert("File with that name already exists!");
				return;
			}
		}

		var file = new FileIcon(fObj.name, this.x, this.y);
		file.create(); // create the file icon components
		this.contents.push(file); // push the fileIcon to the content array
		this.attachIconEH(file); // attach the event handler of the file
	}

	// adds a file icon to the DOM
	addFile(fObj) {
		this.addFileToDOM(fObj);
		// makes asynchronous request to the server to upload the file
		this.uploadFile(fObj);
	}

	// the data is being manipulated as a string and will be sent to the server using a string
	// the data can also be sent to the server using an ArrayBuffer object but I chose string for simplicity
	// as different languages all have strings in common but not the JavaScript object ArrayBuffer
	// http://stackoverflow.com/questions/31581254/how-to-write-a-file-from-an-arraybuffer-in-js
	// link above shows how to write to a file using an array buffer

	/*
		Represents a raw buffer of binary data, which is used to store data for the different typed arrays. 
		ArrayBuffers cannot be read from or written to directly, but can be passed to a typed array or DataView 
		Object to interpret the raw buffer as needed. 
	*/
	uploadFile(file) { // requests the server to upload the file
		var self = this;
		var reader = new FileReader();
		// call back function, which means it is the last thing to get executed
		reader.onload = function(event) {
			var data = reader.result; // returns the result of the callback, on ready state 4 of the reader async function
			
			// when you console.log data it will appear to look like something like this
			// data:application/msword;base64,0M8R4KGxGuEAAAAAAAAAAAAAAAAA........
			// obviously it depends from file to file, but you will get the file type and then
			// comma the actual data, now to extract the data you split and make it into an array
			// by the comma, and now you have the type of data and the contents of the data in an 
			// JavaScript array containing two elements.
			// We don't really care about the first index so we take the second indext and now we 
			// have our array of contents to be stored in the server side!

			// readAsDataUrl automatically converts it to base64 we just need to extract the actual
			// part from the gigantic string

			// convert the data to base64
			var base64 = data.split(",")[1];

			// p element with the id, "#username" contains the user name
			var u = "/" + $("#username").text() + "/" + "uploadFiles";
			var requestObj = {}	
			// fill in the contents of the object with file informations		
			requestObj.name = file.name;
			requestObj.lastModified = file.lastModified;
			requestObj.size = file.size;
			requestObj.type = file.type;
			requestObj.contents = base64;
			requestObj.path = self.path.get;
		
			// make the ajax request
			requestObj = JSON.stringify(requestObj);
			$.ajax({
				url: u,
				type: "POST",
				data: requestObj
			})
		}
		reader.readAsDataURL(file); // calls the reader.onload function
	}

	addFolderToDOM(folderName) {
		// a check to see if folder with a similar name exists or not
		for (var i = 0; i < this.contents.length; ++i) {
			if (this.contents[i].name === folderName) {
				alert("Folder with that name already exists!");
				return;
			}
		}
		var folder = new FolderIcon(folderName, this.x, this.y);
		folder.create();
		this.contents.push(folder);
		this.attachIconEH(folder);

		var folderObj = {};
		folderObj.name = folderName;
		folderObj.path = this.path.get;
	}


	addFolder(folderName) {
		this.addFolderToDOM(folderName);
		this.uploadFolder(folderName);
	}

	// check documentation of the uploadFile method, it follow similar structure
	// except now we are uploading a folder instead of a file
	uploadFolder(folderName) {
		var self = this;
		var folderObj = {};
		folderObj.name = folderName;
		// must follow the convention of ending with a backslash, it is very crucial as the
		// server follows the conention of the path string always ending with "/"
		folderObj.path = this.path.get + folderName + "/";
		$.ajax({
			url:  self.route + "uploadFolders",
			type: "POST",
			data: folderObj
		})
	}

	// on keydown push the keycodde 16 to the stack
	// on keyup if the key is 78 then push it to the stack and then the next
	// instruction is to check if the first and second index is either 16 and 78 or 78 and 16
	// then inside the if statement prompt the user, after the prompt in next instruction
	// simply loop over the array and clear the array
	// the array will get cleared no matter what key up you make, but remember only the
	// right combination will trigger the prompt 
	attachFolderEH() {
		var self = this;
		// checks if the keycode is 16 which is shift on keydown
		// also checks if the keycode is 78 which is n on key up

		$(window).on("keydown", function(event) {
			// 16 for shift button
			if (event.which === 16) {
				self.keyStack.push(16);
			}

		});

		// when a key is released we need to make sure that it is the n key, therefore
		// on release we push key number 78 to the stack of keys
		// after it gets pushed we immedietly check if the combo 16 and 78 is the first and second index
		// or 78 and 16 is the first and second index then we ask the prompt
		$(window).on("keyup", function(event) {
			if (event.which === 78) {
				self.keyStack.push(78);
			}
			// if the first index of the stack of keys is 78 and the second index of the stack of keys is 16 we know we have pressed shift and n consequetively
			// this might look confusing as we might want 78 first and then 16, but in our case, its a keyup, which means
			// key 16 will get released first, and as it gets released it becomes the first index
			// and then 78 gets released therefore n gets released first and then 78
			// same thing might happen the opposite way where you may release the shift key first and then the n key, which is also valid
			if (self.keyStack[0] === 16 && self.keyStack[1] === 78 || self.keyStack[0] == 78 && self.keyStack[1] === 16) {
				var folderName = prompt("Please enter the folder name");
				self.addFolder(folderName);
			}

			// always pop the array by at the end if length becomes greater than 2 as we want to hold a maximum of 2 digits
			// for loop will not work while popping because self.keyStack.length is checked everytime you pop

			// for example you have length of 2, if you go over the loop and pop once your i becomes 1
			// now the self.keyStack.length is also checked and it turns out to be 1 now, and i = 1 and i < 1 is false therefore
			// loop is broken out and we don't end up with all elements being popped

			var keyStackSize = self.keyStack.length;
			for (var i = 0; i < keyStackSize; ++i) {
				self.keyStack.pop();
			}

		})
	


	}

	// attaches file event handler
	// the idea is to loop over the contents array and turn on the the file icon provided
	// and turn off the file icon not provided
	attachIconEH(icon) {
		this.singleClick(icon);
		this.doubleClick(icon);
	}

	singleClick(icon) {
		var self = this; // this in each scope is different in JavaScript
		/* Single click on the icon, deals with both file icons and folder icons */
		// on click the color of the highlight changes
		$("#" + icon.id).on("click", function () {		
			// each file icon has an event handler which loops through the all the file icons
			// then checks if the click is on the current icon and if the icon is not
			// selected then go ahead and select it
			// else unselect all other icons by making them blue and unselecting it
			// each iteration will either be the fileIcon clicked or all other icons
			for (var i = 0; i < self.contents.length; ++i) {
				// both these expression need to be true in order for the entire entire statement to be true
				// which makes sense as we want the current element in the array to be the icon we clicked
				// AND we have to make sure that the element in the array is not selected, because if it is not selected
				// only then can we select it, we can't select something that is unselected
				if (self.contents[i] === icon && !self.contents[i].selected) {
					// red - select
					if (self.contents[i].constructor === FileIcon) {
						$("#" + self.contents[i].id).css("background-image", "url(static/imgs/file-4.png)");
					} else { // else it is a folder icon
						$("#" + self.contents[i].id).css("background-image", "url(static/imgs/folder-2.png)")
					}
					self.contents[i].selected = true;
					self.globalClick = true; // turns on the drop zone event handlers job to do its thing
					self.counter = 0; // prevents an activated global click from deactivating current marked red window
									 // while switching between two tiles (this is mandatory as the global event is fired immediently after a click
									 // it happens simultaneously! )
				} else {
					if (self.contents[i].constructor === FileIcon) { // checks if the array file is a fileIcon
						// blue - unselect
						$("#" + self.contents[i].id).css("background-image", "url(static/imgs/file-3.png)");
					} else { // else it is a folder icon
						$("#" + self.contents[i].id).css("background-image", "url(static/imgs/folder.png)");	
					}
					self.contents[i].selected = false; // turns the boolean false indicating it has been unselected
					
				}
			}
		});
	}

	doubleClick(icon) {
		var self = this;
		/* Double click on the icon, deals with only folder icons */
		// a check is made to make sure this behaviour is not generated for Icons that are not
		// folder icons, double clicks should only work folder icons for now
		if (icon.constructor !== FileIcon) {
			$("#" + icon.id).on("dblclick", function() {
	
				// the path needs to be extended as we are now visiting a new folder
				self.path.extend(icon.name);
	
				// now we need to remove all the current contents from the drop zone
				// and get the conents inside the folder that we just double clicked

				// make request object which encapsulates the path for the server to query

				var requestObj = {};

				requestObj.path = self.path.get;
				requestObj.cwd = self.path.cwd;

				$.ajax({
					url: self.route + "folderDblClick",
					type: "POST",
					data: requestObj,
					success: function(data) {

						console.log("success!");

					}
				})


			});
		}

	}



	// attaches a click event handler to the drop zone window, where upon clicking
	// the dropzone if any item gets selected, it automatically gets deselected
	attachGlobalClickEH() {
		var self = this;
		// target the drop zone for clicks only
		$(this.dropZoneId).on("click", function() {
			if (self.counter > 0) { // first check, makes sure that the self counter is active, if it is not then we go on to the second check
				for (var i = 0; i < self.contents.length; ++i) {
					// checks if the object type if of FileIcon
					if (self.contents[i].constructor === FileIcon) {
						$("#" + self.contents[i].id).css("background-image", "url(static/imgs/file-3.png");
						// also needs to turn off the selected boolean which is indicating that it is currently turned on			
					} else { // else it is a folder icon
						$("#" + self.contents[i].id).css("background-image", "url(static/imgs/folder.png)");
					}
					self.contents[i].selected = false; // unselects by turning the select boolean of each icon false	
				}
				self.counter = 0;
				self.globalClick = false;
			} 		
			else if (self.globalClick) { // this check, checks only if first check is not fulfilled, if globalClick gets turned on
				++self.counter; // then we simply increment the counter so that if another drop zone click is made we can loop through the
								// entire contents and unselect them!
			} 
		});

	}

}