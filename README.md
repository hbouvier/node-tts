#TTS Server

This is a simple Text To Speech (TTS) server that run on Mac OS X.
You can try the basic sample, by entering http://localhost:8082/tts and entrering some text to be played.
This sample queue automatically the text entered in the fields when you modify it and will be played when you hit the play button. If you want to hear them a second time you will have to either modify the text or press the 'ReQueueAll' button before pressing Play again.

You can also use it by hitting the WebService (WS) directly:

  http://localhost:8082/tts/ws/play?text=hello&voice=Fred

Will play "hello" using the voice Fred.

Supported voice on Lion are:

   Kathy, Vicki, Victoria or Alex, Bruce, Fred

Have fun.
