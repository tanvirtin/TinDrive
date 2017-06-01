'use strict' // to use ES6 syntax explicitly


class Delete extends UtilityButton {

	constructor(route) {
		super("delete"); // initializes the base class or super class, this is the base class initializer syntax
		this.contents = [];
		this.route = route; // contains the route with which the ajax request is going to be made
		this.functions = [function(self) { // self needs to be passed as a parameter and the base class will provide the keyword "this" so that base class's ids and contents can be accessed when this function is invoked inside the base class
			// you can't provide $(self.id).on("click", function(self) {}); with self here because the .on
			// call back function actually provides a argument to its call back which is an event object
			// so us providing self would just alias the event object with "self"
			$(self.id).on("click", function() {
				for (var i = 0; i < self.contents.length; ++i) {

					// we also remove the object deleted removed from the DOM immedietly
					$("#wrapper-" + self.contents[i].id).remove(); // we target it by wrapper because wrapper contains both the file icon and the file name!


					// the important information needed for us to do our business is
					// the path and the name of the Icon object, we have to encapsulate the
					// path and the name in an object along with the indicator to whether its
					// a file or not, if its a folder the server should ls everything and turn the
					// flags inside all the files recursively to false!

					// encapsulating information away
					var requestObj = {};
					requestObj.name = self.contents[i].name;
					requestObj.path = self.contents[i].path;
					requestObj.type = self.contents[i].type;

					$.ajax({
						url: self.route + "trash",
						type: "POST",
						data: requestObj,
						success: function(data) {
							console.log("Trashed!");
						}
					})
				}
			});
		}];		
	}

	add(content) {
		this.contents.push(content);
	}

	remove(content) {
		// loop over the contents array and try to match the name of the content with the content provided
		for (var i = 0; i < this.contents.length; ++i) {
			if(this.contents[i].name === content.name) {
				this.contents.splice(i, 1); // remove the elements starting from index i and remove 1 element
				return; // when element is found exit the function
			}
		}
	}


	empty() {
		this.contents = []; // empty out the contents array
	}


}