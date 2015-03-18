# storyteller.js docs

- [Writing modules](#writing-modules)
- [Events](#events)
- [Tools](#tools)

## Introduction
_Note: storyteller.js is new software still undergoing major changes and may break in between minor or even patches. These docs are not guaranteed to be up to date._

## Events
The main way modules talk to each other is through `events` `tool` provided by the storyteller. Messages passed through events are expected to be objects so to provide extensibility in the specified arguments.

There are a few classes of events:
- control
- storyline
- core

<hr>

#### storyline
The storyline is what dictates what path the story takes. Modules that change displays through new slides should react to `storyline` events.

##### `storyline:change`
The slide has been changed and components should reflect this new one.

key  | type
------------- | -------------
`fromIndex` | int |
`toIndex` | int |
`totalSlides` | int |
`$targetSlide` | jQuery element |

<hr>

#### control
The `control` class are for the story controls (ui) to **request** an action being done. A control event might not actually be carried out and changes to the slideshow should not be triggered directly from control events.

##### `control:jump`
Send a message asking to jump to a specific point in the slideshow

key  | type
------------- | -------------
`index`  | int | Slide index to jump to

##### `control:advance`
Send a message asking to advance the slide relative to the current point

key  | type
------------- | -------------
`amount`  | int | Slide index to jump to

##### `control:next` / `control:prev`
High level control to go to the "next" or "previous" slide as dictated by the storyline. This abstracts the concept of next and previous slides and is particularly useful when the storyline is complex (such as nested slides/fragments, forked storyline).

key  | type
------------- | -------------
  | none |



## Tools
Tools are what modules use to interact with the current storyteller and modules used. Modules must explicitly request which tools they want to use.

A list of all the tools is in `storyteller.js` under `moduleTools`.
