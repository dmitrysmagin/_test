/*
 *  Copyright (c) 2018 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

// Blob or File to DataUrl
function readAsDataURL(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = reject;
        fr.onload = function() {
            resolve(fr.result);
        }
        fr.readAsDataURL(blob);
    });
}

// Blob or File to ArrayBuffer
function readAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = reject;
        fr.onload = function() {
            resolve(fr.result);
        }
        fr.readAsArrayBuffer(blob);
    });
}

class ScreenSharing {
	constructor() {
		this.enableStartCapture = true;
		this.enableStopCapture = false;
		this.enableDownloadRecording = false;
		this.stream = null;
		this.chunks = [];
		this.mediaRecorder = null;
		this.status = 'Inactive';
		this.dataUrl = null;
	}

	static _startScreenCapture() {
		if (navigator.getDisplayMedia) {
			return navigator.getDisplayMedia({video: true});
		} else if (navigator.mediaDevices.getDisplayMedia) {
			return navigator.mediaDevices.getDisplayMedia({video: true});
		} else {
			return navigator.mediaDevices.getUserMedia({video: {mediaSource: 'screen'}});
		}
	}

	async _startCapturing(e) {
		console.log('Start capturing.');
		this.status = 'Screen recording started.';
		this.enableStartCapture = false;
		this.enableStopCapture = true;
		this.enableDownloadRecording = false;

		if (this.dataUrl) {
		  window.URL.revokeObjectURL(this.dataUrl);
		}

		this.chunks = [];
		this.dataUrl = null;
		this.stream = await ScreenSharing._startScreenCapture();
		this.stream.addEventListener('inactive', e => {
		  console.log('Capture stream inactive - stop recording!');
		  //this._stopCapturing(e);
		});
		this.mediaRecorder = new MediaRecorder(this.stream, {mimeType: 'video/webm'});
		this.mediaRecorder.addEventListener('dataavailable', event => {
		  if (event.data && event.data.size > 0) {
			this.chunks.push(event.data);
		  }
		});
		this.mediaRecorder.start(10);

		var videoWindow = document.getElementById('videoWindow');
		videoWindow.disabled = true;
		videoWindow.src = '';
	}

	async ChunksToDataUrl(_chunks) {
		// create full copy to be sure chunks[] is not updated behind the scenes
		const chunks = Object.assign([], _chunks);

		let totalsize = 0;
		let offset = 0;

		for(const chunk of chunks)
			totalsize += chunk.size;

		const buffer = new ArrayBuffer(totalsize);
		const view = new DataView(buffer);

		// don't use forEach because 'await chunk.arrayBuffer()' doesn't work then
		for (const chunk of chunks) {
			let inputbuffer = await chunk.arrayBuffer();
			//let inputbuffer = await readAsArrayBuffer(chunk);
			let inputview = new DataView(inputbuffer);

			for (var i = 0; i < chunk.size; i++) {
				view.setUint8(offset + i, inputview.getUint8(i));
			}
			offset += chunk.size;
		}

		let blob = new Blob([view], {type: 'video/webm'});
		let dataUrl = await readAsDataURL(blob);

		return dataUrl;
	}

	async _stopCapturing(e) {
		console.log('Stop capturing.');
		this.status = 'Screen recording completed.';
		this.enableStartCapture = true;
		this.enableStopCapture = false;
		this.enableDownloadRecording = true;

		await this.mediaRecorder.stop();
		this.mediaRecorder = null;

		this.stream.getTracks().forEach(track => track.stop());
		this.stream = null;

		this.dataUrl = await this.ChunksToDataUrl(this.chunks);

		console.log(this.dataUrl);

		var videoWindow = document.getElementById('videoWindow');
		videoWindow.disabled = false;
		videoWindow.src = this.dataUrl;
	}

	_downloadRecording(e) {
		console.log('Download recording.');
		this.enableStartCapture = true;
		this.enableStopCapture = false;
		this.enableDownloadRecording = false;

		const downloadLink = document.querySelector('a#downloadLink');
		downloadLink.addEventListener('progress', e => console.log(e));
		downloadLink.href = this.dataUrl;
		downloadLink.download = 'screen-recording.webm';
		downloadLink.click();
	}
}
