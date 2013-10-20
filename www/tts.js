var tts = (function() {
    
    var audioElements       = [];
    var indexOfAudioPlaying = -1;
    var paused = false;
    var context = '/api/v1/tts.json';
    var defaultVoice = 'Alex';
    var regex=/^(http(?:s)?:\/\/[^/]+)\//;
    var capture = document.URL.match(regex);
    var ttsServerHost = capture[1];
    
    function setVoice(voice) { defaultVoice = voice; }
    
    function queue(text) {
        if (text === '') return;
        console.log('tts::queuing '+audioElements.length + ' text:'+text);
        var audio = document.createElement('audio');
        audio.src= ttsServerHost + context + '/play/' + defaultVoice + '/' + text;
        audio.load();
        audio.addEventListener('ended', function () {
            console.log('ending '+indexOfAudioPlaying);
            ++indexOfAudioPlaying;
            if (indexOfAudioPlaying < audioElements.length) {
                console.log('playing '+indexOfAudioPlaying);
                audioElements[indexOfAudioPlaying].play();
            } else {
                indexOfAudioPlaying = -1;
                audioElements = [];
            }
        });
        audioElements.push(audio);
    }
    function play() {
        if (audioElements.length > 0) {
            if (indexOfAudioPlaying === -1) {
                indexOfAudioPlaying = 0;
                console.log('playing '+indexOfAudioPlaying);
                audioElements[indexOfAudioPlaying].play();
            } else if (paused) {
                console.log('unpausing '+indexOfAudioPlaying);
                audioElements[indexOfAudioPlaying].play();
            }
            paused = false;
        }
    }
    function stop() {
        if (indexOfAudioPlaying !== -1) {
            console.log('stopping '+indexOfAudioPlaying);
            var audio = audioElements[indexOfAudioPlaying];
            indexOfAudioPlaying = -1;
            audioElements = [];
            audio.load('');
        }
    }
    function pause() {
        if (!paused && indexOfAudioPlaying !== -1) {
            console.log('pausing '+indexOfAudioPlaying);
            paused = true;
            audioElements[indexOfAudioPlaying].pause();
        }
    }
    return {
        setHost : function(host) {ttsServerHost = host;},
        queue    : queue,
        play     : play,
        stop     : stop,
        pause    : pause,
        setVoice : setVoice
    };
})();
