## Architecture 0.2
Architecture 0.2 is the idea on how to move forward with a better system for these stories.

`stellar-stories` is the name for this umbrella project that contains multiple things working together.

### gulp assembler
The main gulp flow processes the files into a `dist` folder. Dist folder contains folders for each story which contains an index.html that has the slides and story specific css inside of it.

### story-app
The single page web app that loads modules, dependencies, and initializes storyteller.js. A template that gets packaged by the assembler to inline the slides and configuration files.

### storyteller.js
- `story-teller.js` aspires to be a standalone library for slideshows and manages the UI and modules for the interactive story.
- It is written in ES5 and its only dependencies are SystemJS and jQuery.
- Assumes the story content and modules to already be defined and does not worry about the layer of loading things.
- Will be moved out as an external dependency when mature enough and others may want to use it

#### modules
storyteller.js has modules specifying each part of the UI. Each of the modules have their own UI layer that they can manipulate. Modules communicate with each other through the event system. 

### Stuff deferred for later organization
#### css
CSS will still be sass, but everything will just be dumped into one massive file.

#### asynchronous loading of modules
Although very doable with gulp, 0.2 is just going to dump all the modules into one file so there will still be the concept of modules but they will be loaded in a simple way: all in one file

## Architecture 0.1
0.1 is the modular system specifically written for stories (which was messy and wasn't that good).
Code: https://github.com/stellar/stories/commit/865e6fbf471857497f175bb54028be05382cf1d3

## Architecture 0.0
0.0 was the original version when it was privately developed and named homeslides.
Code: https://github.com/stellar/stories/commit/dbead779c10c3e0f83c39f2bb04d8f1c4bb8c65e
