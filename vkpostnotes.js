// ==UserScript==
// @name         VK Post Notes
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        *://vk.com/*
// @grant         GM_addStyle
// @grant         GM_getValue
// @grant         GM_setValue
// @noframes     true
// ==/UserScript==

(function() {
    'use strict';
    // Your code here... Like this note =)
    
    //Add google fonts. See: http://stackoverflow.com/questions/5751620/ways-to-add-javascript-files-dynamically-in-a-page
    let materialIconsStylesheet=document.createElement("link");
    materialIconsStylesheet.setAttribute("rel", "stylesheet");
    materialIconsStylesheet.setAttribute("type", "text/css");
    materialIconsStylesheet.setAttribute("href", "https://fonts.googleapis.com/icon?family=Material+Icons");
    document.getElementsByTagName("head")[0].appendChild(materialIconsStylesheet);
    
    //constants:
    const customNotesContainerClass = "post_custom_notes_container";
    const gmStorageKey = "gm_vk_post_custom_note";
    
    //helpers:
    let createElement = (htmlText) => {
        let element = document.createElement("div");
        element.innerHTML = htmlText;
        return element.firstChild;
    };
    
    //notes save\restore 
    class NotesStorage {
        constructor() {
            this.notesRuntimeCache = {};
            this.notes = [];
        }
        
        addRuntimeNoteToCache(runtimeNote) {
            
            this.notesRuntimeCache[runtimeNote.noteId] = runtimeNote;
            
            //try to restore the note data
            let note = this.findNoteById(runtimeNote.noteId);
            if (note != null) {
                runtimeNote.text = note.text;
                runtimeNote.category = note.category;
            }
        }
            
        save() {
            //see: http://stackoverflow.com/questions/15730216/how-where-to-store-data-in-a-chrome-tampermonkey-script
             debugger;
            for(var runtimeNoteId in this.notesRuntimeCache) {
                let runtimeNote = this.notesRuntimeCache[runtimeNoteId],
                    noteIndex = this.getNoteIndex(runtimeNote.noteId),
                    note = this.getNoteByIndex(noteIndex),
                    noteShouldBeSaved = (runtimeNote.text && runtimeNote.text.length > 0) || (runtimeNote.category != null),
                    newNote = null;
               
                if (noteShouldBeSaved) {
                    newNote = {
                        noteId: runtimeNote.noteId,
                        postId: runtimeNote.postId,
                        text: runtimeNote.text,
                        category: runtimeNote.category
                    };
                }
                if (note != null) {
                    //handle changed text:
                    if (noteShouldBeSaved) {
                        this.notes[noteIndex] = newNote;
                    }
                    else {
                        //remove note
                        this.notes.splice(noteIndex, 1);
                    }
                } else {
                    //add new note:
                    if (noteShouldBeSaved) {
                        this.notes.push(newNote);
                    }
                }
            }
            let notesData = JSON.stringify(this.notes);
            GM_setValue(gmStorageKey, notesData);
        }
        
//         findRuntimeNoteById(noteId) {
//             let result = this.notes.filter(function(obj) {
//                 return obj.noteId === noteId;
//             });
            
//             return result[0];
//         }
        
        findNoteById(noteId) {
            //let result = this.notes.filter(function(note) {
                //return note.noteId === noteId;
                //return note.noteId === noteId && note.text && note.text.length > 0;
            //});
            
            let index = this.getNoteIndex(noteId);
            if (index >= 0) {
                return this.notes[index];
            }
        }
        
        getNoteIndex(noteId) {
            let index = -1;
            for(let i = 0; i < this.notes.length; ++i)
            {
                if (this.notes[i].noteId == noteId) {
                    index = i;
                    break;
                }
            }
            return index;
        }
        
        getNoteByIndex(index) {
            if (index != null && index >= 0)
            {
                return this.notes[index];
            }
        }
        
        load() {
            try {
                let notes = JSON.parse(GM_getValue(gmStorageKey));
                this.notes = notes;
            } catch(ex) {
                //GM_setValue(gmStorageKey, JSON.stringify([]));
                //this.notes = [];
                console.log("Failed to load notes!!!");
            }
            
        }
        
    }
    
    
    class Lightbox {
        constructor() {
            this.element = null;
            this.postId = null;
        }
        
        setTextAreaElement(textAreaElement) {
            this.textAreaElement = textAreaElement;
        }
        
        show(runtimeNote) {
            this.postId = runtimeNote.postId;
            this.runtimeNote = runtimeNote;
            this.element.style.display = "block";
            if (runtimeNote.text && runtimeNote.text.length > 0)
            {
                this.textAreaElement.value = runtimeNote.text;
            } else {
                this.textAreaElement.value = "";
            }
        }
        hide() {
            this.postId = null;
            this.runtimeNote = null;
            this.element.style.display = "none";
        }
        save() {
            if (this.postId == null) return;
            let text = this.textAreaElement.value;
            if (text.length > 0) {
                this.runtimeNote.text = text;
                //change icon
                this.runtimeNote.addNoteElement.innerHTML = "description";
            } else {
                this.runtimeNote.text = null;
                this.runtimeNote.addNoteElement.innerHTML = "note_add";
            }
            notesStorage.save();
            this.hide();
        }
    }
    
    //'global' variables
    let notesStorage = new NotesStorage(), lightbox = new Lightbox(), isObserving = false;
    
    // Get PostId
    // 26.03.2017 20:04 The format is following: post50101872_500
    let getPostId = (post) => {
        return post.id;
    };
    
    let buildContainerId = (postId) => {
        return postId + "-custom-notes-container";
    };
            
    let buildNoteId = (postId) => {
        return postId + "-custom-note";
    };
    
    //TODO: Check if note text is already saved. If yes, then load text.
    let createNote = (postId) => {
        const addNoteButtonClass = "post-custom-note";
        const categoryButtonClass = "post-custom-note-change-category-button";
        let addNoteButtonId = postId + "-custom-notes-add-note-button";
        let categoryButtonId = postId + "-custom-notes-category-note-button";
        
        let categoryIconId = postId + "-custom-notes-category-icon",
            categoryIconClass = "post-custom-note-category-icon";
       
        let noteId = buildNoteId(postId);
        let noteContainerId = buildContainerId(postId);
        
        
        //Create "Custom Note" container
        // How to add? See : https://material.io/icons/#ic_note_add
        let containerElement = document.createElement("div");
        containerElement.id = noteId;
        containerElement.className = customNotesContainerClass;
        
        //Get category icon by category name
        //TODO: refactor
        let getCategoryIconHtml = (category) => {
            if (category === "cancel") {
                return "<i id='" + categoryIconId + "' class='material-icons " + categoryIconClass + "'>cancel</i>";
            }
            if (category === "done") {
                return "<i id='" + categoryIconId + "' class='material-icons " + categoryIconClass + "'>done</i>";
            }
            return "";
        };
        
        
        //"add note" button
        let note = notesStorage.findNoteById(noteId);
        let buttonsHtml = "", categoryIcon = null;
        if (note == null) {
            buttonsHtml = '<i id="' + addNoteButtonId + '"class="material-icons ' + addNoteButtonClass + '">note_add</i>';
        } else {
            //note could be not empty when category is set that is why we need to verify "text" property
            if (note.text != null) {
                buttonsHtml = '<i id="' + addNoteButtonId + '"class="material-icons ' + addNoteButtonClass + '">description</i>';
            } else {
                buttonsHtml = '<i id="' + addNoteButtonId + '"class="material-icons ' + addNoteButtonClass + '">note_add</i>';
            }
            
            if (note.category != null) {
                categoryIcon = getCategoryIconHtml(note.category);
            }
        }
        
        buttonsHtml+='<i ' + categoryButtonId + '" class="material-icons ' + categoryButtonClass + '">group_work</i>';
        
        if (categoryIcon != null) {
            buttonsHtml += categoryIcon;
        }
        
        containerElement.innerHTML = buttonsHtml;
        let addNoteButtonElement = containerElement.getElementsByClassName(addNoteButtonClass)[0];
        let changeCategoryButtonElement = containerElement.getElementsByClassName(categoryButtonClass)[0];
        let categoryIconElement = containerElement.getElementsByClassName(categoryIconClass)[0];
        
        
        
        let runtimeNote = {
            "noteId": noteId,
            "postId": postId,
            "text": null,
            "category": null,
            "containerElement": containerElement,
            "addNoteElement": addNoteButtonElement,
            "categoryElement": changeCategoryButtonElement,
            "categoryIconElement": categoryIconElement
        };
        
        addNoteButtonElement.onclick = () => {
            lightbox.show(runtimeNote);
        };
        
        changeCategoryButtonElement.onclick = () => {
            //TODO: Change category id
            //runtimeNote
            if (runtimeNote.category == null)
            {
                runtimeNote.category = "cancel";
            } else
            if (runtimeNote.category === "cancel") {
                runtimeNote.category = "done";
            } else
            if (runtimeNote.category === "done") {
                runtimeNote.category = null;
            }
            
            //process dom changes
            if (runtimeNote.category != null) {
                let newElement = createElement(getCategoryIconHtml(runtimeNote.category));
                if (runtimeNote.categoryIconElement == null) {
                    //there wasn't category set before
                    containerElement.appendChild(newElement);
                } else {
                    //a category was set before
                    containerElement.replaceChild(newElement, runtimeNote.categoryIconElement);
                }
                runtimeNote.categoryIconElement = newElement;
            } else {
                containerElement.removeChild(runtimeNote.categoryIconElement);
                runtimeNote.categoryIconElement = null;
            }
            
            notesStorage.save();
        };
        
        //Add note object to notes:
        notesStorage.addRuntimeNoteToCache(runtimeNote);
        
        return runtimeNote;
    };
    
    let createLightboxElement = () => {
        //see: http://stackoverflow.com/questions/11668111/how-do-i-pop-up-a-custom-form-dialog-in-a-greasemonkey-script
        let template = 
            '<div id="gmPopupContainer">' +
                '<form> <!-- For true form use method="POST" action="YOUR_DESIRED_URL" -->' +
                //'<input type="text" id="myNumber1" value=""/>' +
                //'<input type="text" id="myNumber2" value=""/>' +
                '<textarea rows="15" cols="50" id="gm-dlg-post-custom-note-textarea"/></textarea>' +

                '<p id="myNumberSum">&nbsp;</p>' +
                '<button id="gmSaveDlgBtn" class="gmSaveDlgBtnClass" type="button">Save</button>' +
                '<button id="gmCloseDlgBtn" class="gmCloseDlgBtnClass" type="button">Close popup</button>' +
                '</form>' +
            '</div>';
        let lightboxElement = document.createElement("div");
        lightboxElement.innerHTML = template;
        lightboxElement.style.display = "none";
        
        let saveButtonElement = lightboxElement.getElementsByClassName("gmSaveDlgBtnClass")[0];
        let closeButtonElement = lightboxElement.getElementsByClassName("gmCloseDlgBtnClass")[0];
        closeButtonElement.onclick = () => { lightbox.hide(); };
        saveButtonElement.onclick = () => { lightbox.save(); };
        
        
        lightbox.element = lightboxElement;
        document.body.appendChild(lightboxElement);
        lightbox.setTextAreaElement(document.getElementById("gm-dlg-post-custom-note-textarea"));
        
        //--- CSS styles make it work...
        //see: http://stackoverflow.com/questions/1360194/gm-addstyle-not-working
        GM_addStyle ( "#gmPopupContainer{	position: fixed;top: 30%;left: 20%;padding: 2em;background: powderblue;border: 3pxdoubleblack;border-radius: 1ex;z-index: 777;} #gmPopupContainerbutton{cursor: pointer;margin: 1em1em0;border: 1pxoutsetbuttonface;}");
    };
    createLightboxElement();
    
    let processDom = () => {
        isObserving = true;
        
        //Get all posts
        let posts = document.getElementsByClassName("post");
        for(let i = 0; i < posts.length; ++i) {
            let postId = getPostId(posts[i]);
            let postHeader = posts[i].getElementsByClassName("post_header_info")[0];
            let postNoteContainer = postHeader.getElementsByClassName(customNotesContainerClass)[0];
            
            if (postNoteContainer == null) {
                //container is not created yet, create it:
                let note = createNote(postId);
                postHeader.appendChild(note.containerElement);
            }
        }
        
        setTimeout(() => { isObserving = false; }, 100);
        
    };
    
    
    notesStorage.load();
    processDom();
    
    //See: https://greasyfork.org/en/scripts/22457-remove-ad-posts-from-vk-com/code
    //See: http://stackoverflow.com/a/14570614
    var observeDOM = (function(){
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver,
			eventListenerSupported = window.addEventListener;

		return function(obj, callback) {
			if( MutationObserver ){
				// define a new observer
				var obs = new MutationObserver(function(mutations, observer){
					if(mutations[0].addedNodes.length || mutations[0].removedNodes.length)
                        if (isObserving) return;
						callback();
				});
				// have the observer observe foo for changes in children
				obs.observe(obj, { childList:true, subtree:true });
			}
			else if( eventListenerSupported ){
				obj.addEventListener('DOMNodeInserted', callback, false);
				obj.addEventListener('DOMNodeRemoved', callback, false);
			}
		};
	})();
	let containers = document.querySelectorAll('body');
	let n = containers.length;
	for(let i = 0; i<n; ++i)
	{
		let d = containers[i];
        //TODO: Uncomment, performance issues
		observeDOM(d, processDom);
	}
})();