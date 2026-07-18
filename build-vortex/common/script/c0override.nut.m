class C0GlobalEventEmitter {
	_playVoiceSubscriber = null;

	function emitPlayVoice(soundName, soundId) {
		if (_playVoiceSubscriber == null) {
			return;
		}
		_playVoiceSubscriber.handlePlayVoice(soundName, soundId);
	}

	function subscribePlayVoice(subscriber) {
		_playVoiceSubscriber = subscriber;
	}
};
::c0GlobalEventEmitter <- C0GlobalEventEmitter();

class C0PatchCore {
	_app = null;
	_screen = null;
	_subLayer = null;

	_subTable = null;

	function constructor(app) {
		_app = app.weakref();
		_screen = _app.getScreen();

		_subLayer = ::BasicLayer(_screen);
		_subLayer.setPriority(22);

		//_subTable = ::convertPSBValue(::loadData("config/c0_subs.psb").root);
		_subTable = _execRawScript("../c0_subs.nut");

		c0GlobalEventEmitter.subscribePlayVoice(this);
	}

	function _execRawScript(path) {
		local rsc = ::Resource();
		rsc.loadRawBinary(path);
		while (rsc.loading)
			::wait();
		if (rsc.find(path) == null) {
			::printf("failed to load raw script: %s\n", path);
			return;
		}
		return rsc.exec(path);
	}

	function handlePlayVoice(soundName, soundId) {
		if (::SYSTEM_LANGUAGE != 1) {
			return;
		}

		if (!(soundName in _subTable)) {
			return;
		}
		local data = _subTable[soundName];

		_playSubtitle(soundId, data, soundName);
	}

	function _playSubtitle(soundId, data, soundName) {
		if ("events" in data) {
			_playEventsSubtitle(soundId, data.events);
		} else {
			_playTypewriterSubtitle(soundId, data, soundName);
		}
	}

	function _playEventsSubtitle(soundId, events) {
		foreach (event in events) {
			::fork(_animateEventSubtitle.bindenv(this), soundId, event);
		}
	}

	function _animateEventSubtitle(soundId, event) {
		local startOffset = event.start;
		local endOffset = event.end;
		local hAlign = event.hAlign;
		local vAlign = event.vAlign;
		local positionAbsolute = event.absolute;
		local positionX = event.x;
		local positionY = event.y;
		local text = event.text;

		local startTick = ::getCurrentTick();
		local eventStartTick = startTick + startOffset;
		local eventEndTick = startTick + endOffset;

		local bounds = ::getScreenBounds(_screen);

		local anchorX = positionX;
		if (positionAbsolute || hAlign == -1) {
			anchorX += bounds.left;
		} else if (hAlign == 1) {
			anchorX += bounds.left + bounds.width;
		}

		local anchorY = positionY;
		if (positionAbsolute || vAlign == -1) {
			anchorY += bounds.top;
		} else if (vAlign == 1) {
			anchorY += bounds.top + bounds.height;
		}

		local alignPrefix;
		if (hAlign == -1) {
			alignPrefix = "%L";
		} else if (hAlign == 0) {
			alignPrefix = "%C";
		} else if (hAlign == 1) {
			alignPrefix = "%R";
		}

		while (::getCurrentTick() < eventStartTick) {
			::suspend();
			if (!Sound.getVoicePlaying(soundId)) {
				return;
			}
		}

		local textBox = _createTextBox();
		textBox.render(alignPrefix + text, 0, 0);

		local offsetY;
		if (vAlign == -1) {
			offsetY = -textBox.getRenderBounds().height * 0 / 2;
		} else if (vAlign == 0) {
			offsetY = -textBox.getRenderBounds().height * 1 / 2;
		} else if (vAlign == 1) {
			offsetY = -textBox.getRenderBounds().height * 2 / 2;
		}

		textBox.setPos(anchorX, anchorY + offsetY);
		textBox.setShowCount(textBox.getRenderCount());

		while (Sound.getVoicePlaying(soundId) && ::getCurrentTick() < eventEndTick) {
			//textBox.setVisible(Sound.getVoiceVolume(id) > 0);
			::suspend();
		}

		textBox.clear();
	}

	function _playTypewriterSubtitle(soundId, data, soundName) {
		local textSpeed = _app.getConfig("textSpeedCheck", false) ? 1.0 : _app.getConfig("textSpeed", 1.0);
		local autoSpeed = _app.getConfig("autoSpeedCheck", false) ? 1.0 : _app.getConfig("autoSpeed", 1.0);

		local characterTicks = (1.0 - textSpeed) * 50.0*60/1000;
		local autoCharacterTicks = (1.0 - autoSpeed) * 30.0*60/1000;
		local autoWaitTicks = (1.0 - autoSpeed) * 2000.0*60/1000;

		local left = ("left" in data) ? data.left : 32;
		local top = ("top" in data) ? data.top : 32;
		local text = ("text" in data) ? data.text : ("placeholder: " + soundName);

		local bounds = ::getScreenBounds(_screen);
		local textBox = _createTextBox();
		textBox.setPos(bounds.left + left, bounds.top + top);
		textBox.render(text, characterTicks, 0);
		textBox.setShowCount(0);

		local ticksUntilClear = textBox.getRenderDelay() + autoCharacterTicks*textBox.getRenderCount() + autoWaitTicks;

		::fork(_animateTypewriterSubtitle.bindenv(this), soundId, textBox, ticksUntilClear);
	}

	function _animateTypewriterSubtitle(soundId, textBox, ticksUntilClear) {
		local startTick = ::getCurrentTick();
		local animationEndTick = startTick + textBox.getRenderDelay();
		local clearTick = startTick + ticksUntilClear;

		while (Sound.getVoicePlaying(soundId) && ::getCurrentTick() < animationEndTick) {
			local elapsedTicks = ::getCurrentTick() - startTick;
			textBox.setShowCount(textBox.calcShowCount(elapsedTicks));
			::suspend();
		}

		textBox.setShowCount(textBox.getRenderCount());

		while (Sound.getVoicePlaying(soundId) || ::getCurrentTick() < clearTick) {
			::suspend();
		}

		textBox.clear();

		_subThread = null;
	}

	function _createTextBox() {
		local textBox = ::BasicRender(_subLayer, 40, 8, 48);
		textBox.setDefault({
			face = "SourceHanSansJP-Regular",
			color = 0xFFFDFCFC,

			edge = true,
			edgecolor = 0xFF000000,
			edgesize = 5,

			pitch = 0.5,
		});
		textBox.setVisible(true);
		return textBox;
	}
};

::original_Sound_playVoice <- Sound.playVoice;
function Sound::playVoice(...) {
	local args = [];
	args.append(this);
	for (local i = 0; i < vargc; i++) {
		args.append(vargv[i]);
	}

	local storage = args[1];
	local voiceId = ::original_Sound_playVoice.acall(args);

	try {
		::c0GlobalEventEmitter.emitPlayVoice(storage, voiceId);
	} catch (e) {
		::printException(e);
	}

	return voiceId;
}

function gameMain(args, init) {
    local app = ::MyApplication(init);
	local c0PatchCore = ::C0PatchCore(app);
	app.main(args);
}
