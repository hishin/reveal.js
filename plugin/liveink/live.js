/**
 * Handles opening of and synchronization with the reveal.js
 * notes window.
 *
 * Handshake process:
 * 1. This window posts 'connect' to notes window
 *    - Includes URL of presentation to show
 * 2. Notes window responds with 'connected' when it is available
 * 3. This window proceeds to send the current presentation state
 *    to the notes window
 */
var RevealNotes = (function() {

	function openNotes( notesFilePath ) {

		if( !notesFilePath ) {
			var jsFileLocation = document.querySelector('script[src$="live.js"]').src;  // this js file path
			jsFileLocation = jsFileLocation.replace(/live\.js(\?.*)?$/, '');   // the js folder path
			notesFilePath = jsFileLocation + 'audience.html';

			addDataIDs(document);
			applySpeakerStyle();
			addSpeakerOnlyElemContextMenu();
			addEventListeners();
		}

		var notesPopup = window.open( notesFilePath, 'reveal.js - Audience View', 'width=1100,height=700' );

		/**
		 * Connect to the notes window through a postmessage handshake.
		 * Using postmessage enables us to work in situations where the
		 * origins differ, such as a presentation being opened from the
		 * file system.
		 */
		function connect() {
			// Keep trying to connect until we get a 'connected' message back
			var connectInterval = setInterval( function() {
				notesPopup.postMessage( JSON.stringify( {
					namespace: 'reveal-notes',
					type: 'connect',
					url: window.location.protocol + '//' + window.location.host + window.location.pathname + window.location.search,
					state: Reveal.getState()
				} ), '*' );
			}, 500 );

			window.addEventListener( 'message', function( event ) {
				var data = JSON.parse( event.data );
				if( data && data.namespace === 'reveal-notes' && data.type === 'connected' ) {
					clearInterval( connectInterval );
					onConnected();
				}
			} );
		}

		/**
		 * Posts the current slide data to the notes window
		 */
		function post() {

			var slideElement = Reveal.getCurrentSlide(),
				notesElement = slideElement.querySelector( 'aside.notes' );

			var messageData = {
				namespace: 'reveal-notes',
				type: 'state',
				notes: '',
				markdown: false,
				whitespace: 'normal',
				state: Reveal.getState()
			};

			// Look for notes defined in a slide attribute
			if( slideElement.hasAttribute( 'data-notes' ) ) {
				messageData.notes = slideElement.getAttribute( 'data-notes' );
				messageData.whitespace = 'pre-wrap';
			}

			// Look for notes defined in an aside element
			if( notesElement ) {
				messageData.notes = notesElement.innerHTML;
				messageData.markdown = typeof notesElement.getAttribute( 'data-markdown' ) === 'string';
			}

			notesPopup.postMessage( JSON.stringify( messageData ), '*' );

		}

		/**
		 * Called once we have established a connection to the notes
		 * window.
		 */
		function onConnected() {

			// Monitor events that trigger a change in state
			Reveal.addEventListener( 'slidechanged', post );
			Reveal.addEventListener( 'fragmentshown', post );
			Reveal.addEventListener( 'fragmenthidden', post );
			Reveal.addEventListener( 'overviewhidden', post );
			Reveal.addEventListener( 'overviewshown', post );
			Reveal.addEventListener( 'paused', post );
			Reveal.addEventListener( 'resumed', post );


			// Post the initial state
			post();

		}


		/**
		 * Add data-id to each element for reference when
		 * communicating user actions to audience view
         */
		function addDataIDs(doc) {
			var elems = doc.body.getElementsByTagName("*");
			for (var i = 0; i < elems.length; i++) {
				elems[i].setAttribute('data-id', i);
			}
		}


		/**
		 * Apply speaker.css to main view
         */
		function applySpeakerStyle() {
			var link = document.createElement('link');
			link.rel = 'stylesheet';
			link.type = 'text/css';
			link.href = jsFileLocation + 'speaker.css'
			link.id = 'viewer';
			document.getElementsByTagName('head')[0].appendChild(link);
		}

		function addSpeakerOnlyElemContextMenu() {
			var ul = document.createElement('ul');
			ul.id = 'so-element-context-menu';
			ul.classList.add('dropdown-menu');
			ul.setAttribute('role', 'menu');
			ul.style = 'display: none';
			// Edit
			var li = document.createElement('li');
			var option = document.createElement('a');
			option.setAttribute('tabindex', '-1');
			var icon = document.createElement( 'i' );
			icon.classList.add( 'glyphicon' );
			icon.classList.add( 'glyphicon-pencil' );
			icon.innerHTML = '&nbsp;Edit';
			option.appendChild(icon);
			li.appendChild(option);
			ul.appendChild(li);

			// Reveal
			li = document.createElement('li');
			option = document.createElement('a');
			option.setAttribute('tabindex', '-1');
			option.addEventListener('click', revealElement);
			icon = document.createElement( 'i' );
			icon.classList.add( 'glyphicon' );
			icon.classList.add( 'glyphicon-eye-open' );
			icon.innerHTML = '&nbsp;Reveal';
			option.appendChild(icon);
			li.appendChild(option);
			ul.appendChild(li);

			// Hide
			li = document.createElement('li');
			option = document.createElement('a');
			option.setAttribute('tabindex', '-1');
			option.addEventListener('click', hideElement);
			icon = document.createElement( 'i' );
			icon.classList.add( 'glyphicon' );
			icon.classList.add( 'glyphicon-eye-close' );
			icon.innerHTML = '&nbsp;Hide';
			option.appendChild(icon);
			li.appendChild(option);
			ul.appendChild(li);

			// Dismiss
			li = document.createElement('li');
			option = document.createElement('a');
			option.setAttribute('tabindex', '-1');
			icon = document.createElement( 'i' );
			icon.classList.add( 'glyphicon' );
			icon.classList.add( 'glyphicon-remove-circle' );
			icon.innerHTML = '&nbsp;Dismiss';
			option.appendChild(icon);
			li.appendChild(option);
			ul.appendChild(li);

			document.getElementsByTagName( 'body' )[0].appendChild(ul);
		}

		var selectedElement = null;
		function revealContextMenu(event) {
			// do not trigger if ctrl key is pressed
			if (event.ctrlKey)
				return;

			event.preventDefault();
			var menu = document.getElementById( 'so-element-context-menu');
			menu.style.position = 'absolute';
			menu.style.left = event.clientX +'px';
			menu.style.top = event.clientY +'px';
			menu.style.display = 'block';

			selectedElement = event.currentTarget;
		};

		function hideContextMenu(event) {
			var menu = document.getElementById( 'so-element-context-menu');
			menu.style.display = 'none';
			selectedElement = null;
		};

		function addEventListeners() {
			var soElements = document.querySelectorAll( '.speaker-only' );
			for (var i = 0; i < soElements.length; i++) {
				soElements[i].addEventListener('contextmenu', revealContextMenu, false);
			}
			document.body.addEventListener('click', hideContextMenu);

			// if chalkboard plugin is enabled


		};

		function revealElement() {
			if (selectedElement) {

				var messageData = {
					namespace: 'reveal-notes',
					type: 'action',
					state: Reveal.getState(),
					elemid: selectedElement.getAttribute('data-id'),
					action: 'reveal-element'
				};
				selectedElement.classList.remove('speaker-only');
				notesPopup.postMessage( JSON.stringify( messageData ), '*' );
			}
		};

		function hideElement() {
			if (selectedElement) {

				var messageData = {
					namespace: 'reveal-notes',
					type: 'action',
					state: Reveal.getState(),
					elemid: selectedElement.getAttribute('data-id'),
					action: 'hide-element'
				};
				selectedElement.classList.add('speaker-only');
				notesPopup.postMessage( JSON.stringify( messageData ), '*' );
			}
		};

		connect();

	}


	if( !/receiver/i.test( window.location.search ) ) {

		// If the there's a 'notes' query set, open directly
		if( window.location.search.match( /(\?|\&)notes/gi ) !== null ) {
			openNotes();
		}

		// Open the notes when the 's' key is hit
		document.addEventListener( 'keydown', function( event ) {
			// Disregard the event if the target is editable or a
			// modifier is present
			if ( document.querySelector( ':focus' ) !== null || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey ) return;

			// Disregard the event if keyboard is disabled
			if ( Reveal.getConfig().keyboard === false ) return;

			if( event.keyCode === 83 ) {
				event.preventDefault();
				openNotes();
			}
		}, false );

		// Show our keyboard shortcut in the reveal.js help overlay
		if( window.Reveal ) Reveal.registerKeyboardShortcut( 'S', 'Speaker notes view' );

	}

	return { open: openNotes };

})();
