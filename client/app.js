document.addEventListener('DOMContentLoaded', () => {
    // Pantallas
    const introScreen = document.getElementById('intro-screen');
    const editorScreen = document.getElementById('editor-screen');
    
    // Intro
    const btnExtract = document.getElementById('btn-extract');
    const extractStatus = document.getElementById('extract-status');
    const spotifyUrl = document.getElementById('spotify-url');
    const recentAudiosDiv = document.getElementById('recent-audios');
    const recentList = document.getElementById('recent-list');
    
    // Editor Info
    const trackTitle = document.getElementById('track-title');
    const trackArtist = document.getElementById('track-artist');
    const lyricsBadge = document.getElementById('lyrics-badge');
    const exportDuration = document.getElementById('export-duration');
    const btnRender = document.getElementById('btn-render');
    const renderStatus = document.getElementById('render-status');
    const btnDownload = document.getElementById('btn-download');
    
    // Preview & Timeline
    const bgInput = document.getElementById('bg-video');
    const previewVideo = document.getElementById('preview-video');
    const previewAudio = document.getElementById('preview-audio');
    const lyricsOverlay = document.getElementById('preview-lyrics-overlay');
    const timeDisplay = document.getElementById('time-display');
    const playhead = document.getElementById('playhead');
    const trackVideo = document.getElementById('track-video');
    const trackLyrics = document.getElementById('track-lyrics');
    const trackAudio = document.getElementById('track-audio');
    const timelineContainer = document.querySelector('.timeline-container');
    const timelineTools = document.querySelector('.timeline-tools');
    
    // Controles
    const btnPlayPause = document.getElementById('btn-play-pause');
    const btnBack5 = document.getElementById('btn-back-5');
    const btnForward5 = document.getElementById('btn-forward-5');
    const btnForwardFrame = document.getElementById('btn-forward-frame');

    // NLE STATE
    let currentJobId = null;
    let uploadedBgPath = null;
    let bgVideoDuration = 0; 
    let audioDuration = 0;
    let parsedLyrics = []; 
    let PIXELS_PER_SECOND = 20;
    
    let tracks = {
        video: [],
        lyrics: [],
        audio: []
    };
    
    let isPlaying = false;
    let isCutMode = false;

    // --- AUDIOS RECIENTES ---
    async function loadRecentAudios() {
        try {
            const res = await fetch('/api/recent');
            const data = await res.json();
            if (data.recent && data.recent.length > 0) {
                recentAudiosDiv.style.display = 'block';
                recentList.innerHTML = '';
                data.recent.reverse().forEach(item => {
                    const btn = document.createElement('button');
                    btn.className = 'btn-secondary';
                    btn.style.textAlign = 'left';
                    btn.style.padding = '10px';
                    btn.style.fontSize = '0.9rem';
                    btn.innerHTML = `🎵 <strong>${item.title}</strong> - ${item.artist}`;
                    btn.addEventListener('click', () => {
                        spotifyUrl.value = item.url;
                        btnExtract.click();
                    });
                    recentList.appendChild(btn);
                });
            }
        } catch (e) {
            console.error("Error cargando recientes:", e);
        }
    }
    loadRecentAudios();

    // ESTILO DINAMICO PARA ANIMACION
    if (!document.getElementById('lyrics-anim-style')) {
        const style = document.createElement('style');
        style.id = 'lyrics-anim-style';
        style.innerHTML = `
            @keyframes fadeInUpInsta {
                0% { opacity: 0; transform: translateY(10px) scale(0.95); }
                100% { opacity: 1; transform: translateY(0) scale(1.05); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // CUT GUIDE
    const cutGuide = document.createElement('div');
    cutGuide.className = 'cut-guide';
    timelineContainer.appendChild(cutGuide);

    timelineContainer.addEventListener('mousemove', (e) => {
        if (isCutMode) {
            const rect = timelineContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineContainer.scrollLeft;
            cutGuide.style.left = x + 'px';
        }
    });

    // MASTER CLOCK
    let masterTime = 0;
    let lastFrameTime = performance.now();

    // CUT TOOL BUTTON
    const btnCutToggle = document.createElement('button');
    btnCutToggle.className = 'btn-small btn-secondary';
    btnCutToggle.style.marginLeft = '10px';
    btnCutToggle.innerHTML = '✂️ Cuchilla (Off)';
    btnCutToggle.addEventListener('click', () => {
        isCutMode = !isCutMode;
        btnCutToggle.innerHTML = isCutMode ? '✂️ Cuchilla (On)' : '✂️ Cuchilla (Off)';
        btnCutToggle.className = isCutMode ? 'btn-small btn-primary' : 'btn-small btn-secondary';
        if (isCutMode) {
            timelineContainer.classList.add('cut-mode');
        } else {
            timelineContainer.classList.remove('cut-mode');
        }
    });
    timelineTools.appendChild(btnCutToggle);

    // --- RULER & ZOOM ---
    function drawRuler() {
        let maxSeconds = audioDuration > 0 ? audioDuration + 10 : 60;
        tracks.video.forEach(c => maxSeconds = Math.max(maxSeconds, c.start + c.duration + 5));
        
        let oldRuler = document.querySelector('.timeline-ruler');
        if(oldRuler) oldRuler.remove();
        
        const ruler = document.createElement('div');
        ruler.className = 'timeline-ruler';
        ruler.style.width = (maxSeconds * PIXELS_PER_SECOND) + 'px';
        
        const step = PIXELS_PER_SECOND < 10 ? 10 : (PIXELS_PER_SECOND > 50 ? 1 : 5);
        for (let i = 0; i <= maxSeconds; i += step) {
            const mark = document.createElement('div');
            mark.className = 'ruler-mark';
            mark.style.left = (i * PIXELS_PER_SECOND) + 'px';
            mark.textContent = i + 's';
            ruler.appendChild(mark);
        }
        timelineContainer.appendChild(ruler);
        
        document.querySelectorAll('.track-content').forEach(tc => tc.style.width = (maxSeconds * PIXELS_PER_SECOND) + 'px');
    }

    timelineContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -2 : 2;
            PIXELS_PER_SECOND = Math.max(5, Math.min(200, PIXELS_PER_SECOND + delta));
            drawRuler();
            renderAllTracks();
            updatePreviewAtTime(masterTime);
        }
    });

    timelineContainer.addEventListener('mousedown', (e) => {
        if (isCutMode || e.target.closest('.clip') || e.target.closest('.resize-handle') || e.target.closest('.resize-handle-left') || e.target.closest('.playhead')) return;
        
        // Clic directo para saltar en el timeline
        const rect = timelineContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left + timelineContainer.scrollLeft - 120;
        if (clickX >= 0) {
            masterTime = clickX / PIXELS_PER_SECOND;
            updatePreviewAtTime(masterTime);
        }
    });

    // --- HELPER POLLING ---
    async function pollStatus(jobId, onProgress) {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/status/${jobId}`);
                    const data = await res.json();
                    
                    if (data.status === 'completed') {
                        clearInterval(interval);
                        resolve(data);
                    } else if (data.status === 'error') {
                        clearInterval(interval);
                        reject(new Error(data.error));
                    } else {
                        if (onProgress) onProgress(data.status);
                    }
                } catch (err) {
                    clearInterval(interval);
                    reject(err);
                }
            }, 2000);
        });
    }

    function parseLRC(lrcText) {
        const lines = lrcText.split('\n');
        const lyrics = [];
        const regex = /\[(\d{2}):(\d{2}\.\d{2})\](.*)/;
        for (let line of lines) {
            const match = line.match(regex);
            if (match) {
                const mins = parseInt(match[1]);
                const secs = parseFloat(match[2]);
                const text = match[3].trim();
                if (text.length > 0) {
                    lyrics.push({ time: (mins * 60) + secs, text });
                }
            }
        }
        return lyrics;
    }

    async function loadPreviewData(jobId) {
        previewAudio.src = `/api/data/${jobId}/audio`;
        previewAudio.load();
        
        previewAudio.onloadedmetadata = () => {
            audioDuration = previewAudio.duration;
            tracks.audio = [{ id: Date.now() + 1, type: 'audio', start: 0, duration: audioDuration, mediaStart: 0 }];
            
            exportDuration.value = Math.min(15, audioDuration).toFixed(1);
            drawRuler();
            renderAllTracks();
            updatePreviewAtTime(0);
        };

        try {
            const res = await fetch(`/api/data/${jobId}/lyrics`);
            if (res.ok) {
                const data = await res.json();
                parsedLyrics = parseLRC(data.lyrics);
                let lDur = audioDuration || 180;
                tracks.lyrics = [{ id: Date.now() + 2, type: 'lyrics', start: 0, duration: lDur, mediaStart: 0 }];
                renderAllTracks();
                updatePreviewAtTime(0);
            }
        } catch(e) {}
    }

    btnExtract.addEventListener('click', async () => {
        const url = spotifyUrl.value;
        if (!url || !url.includes('spotify.com')) {
            extractStatus.textContent = 'Ingresa una URL válida de Spotify.';
            return;
        }

        btnExtract.disabled = true;
        btnExtract.textContent = 'Procesando...';
        extractStatus.textContent = 'Descargando audio y letras... Esto tomará un minuto.';

        try {
            const res = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            
            if (data.status === 'cached') {
                extractStatus.textContent = 'Cargado desde el caché instantáneamente.';
                currentJobId = data.job_id;
            } else {
                const result = await pollStatus(data.job_id);
                currentJobId = data.job_id;
            }
            
            const finalRes = await fetch(`/api/status/${currentJobId}`);
            const finalData = await finalRes.json();
            
            if(finalData.status !== 'completed') throw new Error(finalData.error || "Error desconocido");
            
            trackTitle.textContent = finalData.data.track_name || 'Desconocido';
            trackArtist.textContent = finalData.data.artist_name || 'Desconocido';
            if (finalData.data.lrc_path) {
                lyricsBadge.textContent = 'Letras Sincronizadas: Sí';
                lyricsBadge.classList.add('success');
            } else {
                lyricsBadge.textContent = 'Letras Sincronizadas: No';
                lyricsBadge.classList.remove('success');
            }
            
            introScreen.style.display = 'none';
            editorScreen.style.display = 'flex';
            
            await loadPreviewData(currentJobId);
        } catch (err) {
            extractStatus.textContent = `Error: ${err.message}`;
            btnExtract.disabled = false;
            btnExtract.textContent = 'Extraer Audio y Letras';
        }
    });

    bgInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileURL = URL.createObjectURL(file);
        previewVideo.src = fileURL;
        
        previewVideo.onloadedmetadata = async () => {
            bgVideoDuration = previewVideo.duration;
            tracks.video = [{ id: Date.now() + 3, type: 'video', start: 0, duration: bgVideoDuration, mediaStart: 0 }];
            
            drawRuler();
            renderAllTracks();
            document.getElementById('btn-add-video').disabled = false;
            updatePreviewAtTime(0);
            
            renderStatus.textContent = 'Subiendo video...';
            btnRender.disabled = true;
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await fetch('/api/upload_bg', { method: 'POST', body: formData });
                const data = await res.json();
                uploadedBgPath = data.file_path;
                renderStatus.textContent = 'Fondo subido correctamente.';
            } catch (err) {
                renderStatus.textContent = 'Error al subir fondo.';
            } finally {
                btnRender.disabled = false;
            }
        };
    });

    let dragState = null;

    function renderAllTracks() {
        trackVideo.innerHTML = '';
        trackLyrics.innerHTML = '';
        trackAudio.innerHTML = '';
        
        tracks.video.forEach(c => renderClip(c, trackVideo));
        tracks.lyrics.forEach(c => renderClip(c, trackLyrics));
        tracks.audio.forEach(c => renderClip(c, trackAudio));
        
        recalculateTotalDuration();
    }

    function renderClip(clipObj, container) {
        const block = document.createElement('div');
        block.className = `clip clip-${clipObj.type}`;
        block.style.left = (clipObj.start * PIXELS_PER_SECOND) + 'px';
        block.style.width = (clipObj.duration * PIXELS_PER_SECOND) + 'px';
        
        let label = clipObj.type === 'video' ? 'Video' : (clipObj.type === 'lyrics' ? 'Letras' : 'Audio');
        block.innerHTML = `<span>${label}</span>`;
        
        block.addEventListener('click', (e) => {
            if (isCutMode) {
                const rect = block.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const timeInClip = clickX / PIXELS_PER_SECOND;
                
                if (timeInClip > 0.5 && timeInClip < clipObj.duration - 0.5) {
                    
                    const cutClip = (targetClip, typeArray) => {
                        const newClip = {
                            id: Date.now() + Math.random(),
                            type: targetClip.type,
                            start: targetClip.start + timeInClip,
                            duration: targetClip.duration - timeInClip,
                            mediaStart: targetClip.mediaStart + timeInClip
                        };
                        targetClip.duration = timeInClip;
                        tracks[typeArray].push(newClip);
                    };

                    cutClip(clipObj, clipObj.type);
                    
                    if (clipObj.type === 'audio') {
                        const linkedLyric = tracks.lyrics.find(l => Math.abs(l.start - clipObj.start) < 0.1 && Math.abs(l.duration - (clipObj.duration + timeInClip)) < 0.1);
                        if (linkedLyric) cutClip(linkedLyric, 'lyrics');
                    } else if (clipObj.type === 'lyrics') {
                        const linkedAudio = tracks.audio.find(a => Math.abs(a.start - clipObj.start) < 0.1 && Math.abs(a.duration - (clipObj.duration + timeInClip)) < 0.1);
                        if (linkedAudio) cutClip(linkedAudio, 'audio');
                    }

                    renderAllTracks();
                }
                e.stopPropagation();
            }
        });

        block.addEventListener('mousedown', (e) => {
            if (isCutMode || e.target.classList.contains('resize-handle') || e.target.classList.contains('resize-handle-left')) return;
            
            let linkedClip = null;
            if (clipObj.type === 'audio') {
                linkedClip = tracks.lyrics.find(l => Math.abs(l.start - clipObj.start) < 0.1 && Math.abs(l.duration - clipObj.duration) < 0.1);
            } else if (clipObj.type === 'lyrics') {
                linkedClip = tracks.audio.find(a => Math.abs(a.start - clipObj.start) < 0.1 && Math.abs(a.duration - clipObj.duration) < 0.1);
            }

            dragState = {
                action: 'move',
                clip: clipObj,
                linkedClip: linkedClip,
                startX: e.clientX,
                initialStart: clipObj.start,
                linkedInitialStart: linkedClip ? linkedClip.start : 0,
                hasMoved: false
            };
        });

        const handleR = document.createElement('div');
        handleR.className = 'resize-handle';
        handleR.addEventListener('mousedown', (e) => {
            if (isCutMode) return;
            
            let linkedClip = null;
            if (clipObj.type === 'audio') linkedClip = tracks.lyrics.find(l => Math.abs(l.start - clipObj.start) < 0.1 && Math.abs(l.duration - clipObj.duration) < 0.1);
            else if (clipObj.type === 'lyrics') linkedClip = tracks.audio.find(a => Math.abs(a.start - clipObj.start) < 0.1 && Math.abs(a.duration - clipObj.duration) < 0.1);

            dragState = {
                action: 'resize-right',
                clip: clipObj,
                linkedClip: linkedClip,
                startX: e.clientX,
                initialDuration: clipObj.duration,
                hasMoved: false
            };
            e.stopPropagation();
        });
        handleR.addEventListener('click', (e) => e.stopPropagation()); // Evitar bug de cuchilla
        
        const handleL = document.createElement('div');
        handleL.className = 'resize-handle-left';
        handleL.addEventListener('mousedown', (e) => {
            if (isCutMode) return;
            
            let linkedClip = null;
            if (clipObj.type === 'audio') linkedClip = tracks.lyrics.find(l => Math.abs(l.start - clipObj.start) < 0.1 && Math.abs(l.duration - clipObj.duration) < 0.1);
            else if (clipObj.type === 'lyrics') linkedClip = tracks.audio.find(a => Math.abs(a.start - clipObj.start) < 0.1 && Math.abs(a.duration - clipObj.duration) < 0.1);

            dragState = {
                action: 'resize-left',
                clip: clipObj,
                linkedClip: linkedClip,
                startX: e.clientX,
                initialStart: clipObj.start,
                initialDuration: clipObj.duration,
                initialMediaStart: clipObj.mediaStart,
                hasMoved: false
            };
            e.stopPropagation();
        });
        handleL.addEventListener('click', (e) => e.stopPropagation()); // Evitar bug de cuchilla
        
        block.appendChild(handleL);
        block.appendChild(handleR);
        container.appendChild(block);
    }

    function getSnapTime(targetTime, excludeClipId) {
        let bestSnap = targetTime;
        let minDiff = 0.5;
        
        const checkSnap = (time) => {
            const diff = Math.abs(targetTime - time);
            if (diff < minDiff) {
                minDiff = diff;
                bestSnap = time;
            }
        };

        checkSnap(masterTime);

        ['video', 'audio', 'lyrics'].forEach(trackName => {
            tracks[trackName].forEach(c => {
                if (c.id !== excludeClipId) {
                    checkSnap(c.start);
                    checkSnap(c.start + c.duration);
                }
            });
        });
        
        return bestSnap;
    }

    document.addEventListener('mousemove', (e) => {
        if (dragState) {
            const diffTime = (e.clientX - dragState.startX) / PIXELS_PER_SECOND;
            
            // Fix bug de 1 segundo: Evitar aplicar lógica si apenas se movió el ratón
            if (Math.abs(e.clientX - dragState.startX) > 3) {
                dragState.hasMoved = true;
            }
            
            if (dragState.hasMoved) {
                if (dragState.action === 'move') {
                    let proposedStart = Math.max(0, dragState.initialStart + diffTime);
                    proposedStart = getSnapTime(proposedStart, dragState.clip.id);
                    
                    const snapDiff = proposedStart - dragState.initialStart;
                    dragState.clip.start = proposedStart;
                    
                    if (dragState.linkedClip) {
                        dragState.linkedClip.start = Math.max(0, dragState.linkedInitialStart + snapDiff);
                    }
                } 
                else if (dragState.action === 'resize-right') {
                    let proposedEnd = Math.max(dragState.clip.start + 0.5, dragState.initialStart + dragState.initialDuration + diffTime);
                    proposedEnd = getSnapTime(proposedEnd, dragState.clip.id);
                    dragState.clip.duration = proposedEnd - dragState.clip.start;
                    
                    if (dragState.linkedClip) {
                        dragState.linkedClip.duration = dragState.clip.duration;
                    }
                }
                else if (dragState.action === 'resize-left') {
                    let proposedStart = Math.max(0, dragState.initialStart + diffTime);
                    // Solo intentar snap si el diffTime es notable, para evitar saltos raros al inicio
                    proposedStart = getSnapTime(proposedStart, dragState.clip.id);
                    
                    const shift = proposedStart - dragState.initialStart;
                    const newDuration = dragState.initialDuration - shift;
                    
                    if (newDuration >= 0.5) {
                        dragState.clip.start = proposedStart;
                        dragState.clip.duration = newDuration;
                        dragState.clip.mediaStart = Math.max(0, dragState.initialMediaStart + shift);
                        
                        if (dragState.linkedClip) {
                            dragState.linkedClip.start = proposedStart;
                            dragState.linkedClip.duration = newDuration;
                            dragState.linkedClip.mediaStart = Math.max(0, dragState.initialMediaStart + shift);
                        }
                    }
                }
                renderAllTracks();
            }
        }
        
        if (isDraggingPlayhead) {
            const rect = timelineContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineContainer.scrollLeft - 120;
            masterTime = Math.max(0, x / PIXELS_PER_SECOND);
            updatePreviewAtTime(masterTime);
        }
    });

    document.addEventListener('mouseup', () => {
        dragState = null;
        isDraggingPlayhead = false;
    });

    function recalculateTotalDuration() {
        let maxTime = 0;
        tracks.video.forEach(c => maxTime = Math.max(maxTime, c.start + c.duration));
        exportDuration.value = maxTime > 0 ? maxTime.toFixed(1) : exportDuration.value;
    }

    document.getElementById('btn-add-video').addEventListener('click', () => {
        let lastEnd = 0;
        tracks.video.forEach(c => lastEnd = Math.max(lastEnd, c.start + c.duration));
        tracks.video.push({ id: Date.now(), type: 'video', start: lastEnd, duration: bgVideoDuration, mediaStart: 0 });
        drawRuler();
        renderAllTracks();
    });

    let isDraggingPlayhead = false;
    
    playhead.addEventListener('mousedown', (e) => {
        isDraggingPlayhead = true;
        e.preventDefault();
        e.stopPropagation();
    });

    let lastRenderedLyrics = "";
    
    function getLyricsAtMediaTime(mediaTime) {
        if (!parsedLyrics.length) return null;
        
        let currentIndex = -1;
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (mediaTime >= parsedLyrics[i].time) {
                currentIndex = i;
            } else {
                break;
            }
        }
        
        if (currentIndex === -1) return null;
        
        return {
            past: currentIndex > 0 ? parsedLyrics[currentIndex-1].text : '',
            current: parsedLyrics[currentIndex].text,
            next: currentIndex < parsedLyrics.length - 1 ? parsedLyrics[currentIndex+1].text : ''
        };
    }

    function renderViralLyrics(lyrics) {
        if (!lyrics) {
            lyricsOverlay.innerHTML = '';
            lastRenderedLyrics = null;
            return;
        }
        
        // Evitar re-render innecesario para que las animaciones CSS se activen
        if (lastRenderedLyrics === lyrics.current) return;
        lastRenderedLyrics = lyrics.current;
        
        let html = '';
        if (lyrics.past) html += `<div class="lyric-line lyric-past" style="opacity: 0.4; transform: scale(0.8);">${lyrics.past}</div>`;
        
        // Animación inyectada a la línea actual
        html += `<div class="lyric-line lyric-current" style="animation: fadeInUpInsta 0.3s forwards;">${lyrics.current}</div>`;
        
        if (lyrics.next) html += `<div class="lyric-line lyric-next" style="opacity: 0.4; transform: scale(0.8);">${lyrics.next}</div>`;
        
        lyricsOverlay.innerHTML = html;
    }

    let isAudioSeeking = false;
    let isVideoSeeking = false;
    
    previewAudio.onseeked = () => isAudioSeeking = false;
    previewVideo.onseeked = () => isVideoSeeking = false;

    function getBlockAtTime(trackArray, time) {
        return trackArray.find(c => time >= c.start && time < c.start + c.duration);
    }

    function updatePreviewAtTime(time) {
        playhead.style.left = (time * PIXELS_PER_SECOND + 120) + 'px';
        timeDisplay.textContent = `${time.toFixed(1)}s`;

        const vBlock = getBlockAtTime(tracks.video, time);
        if (vBlock && bgVideoDuration > 0) {
            previewVideo.style.opacity = '1';
            const videoTargetTime = vBlock.mediaStart + (time - vBlock.start);
            if (!isVideoSeeking && Math.abs(previewVideo.currentTime - videoTargetTime) > 0.25) {
                isVideoSeeking = true;
                previewVideo.currentTime = Math.min(videoTargetTime, bgVideoDuration - 0.01);
            }
        } else {
            previewVideo.style.opacity = '0';
        }

        const aBlock = getBlockAtTime(tracks.audio, time);
        if (aBlock && audioDuration > 0) {
            previewAudio.volume = 1;
            const audioTargetTime = aBlock.mediaStart + (time - aBlock.start);
            // Evitar loop infinito de seek que muteaba el audio
            if (!isAudioSeeking && Math.abs(previewAudio.currentTime - audioTargetTime) > 0.25) {
                isAudioSeeking = true;
                previewAudio.currentTime = Math.min(audioTargetTime, audioDuration - 0.01);
            }
        } else {
            previewAudio.volume = 0;
        }

        const lBlock = getBlockAtTime(tracks.lyrics, time);
        if (lBlock) {
            const lyricsMediaTime = lBlock.mediaStart + (time - lBlock.start);
            renderViralLyrics(getLyricsAtMediaTime(lyricsMediaTime));
        } else {
            if (lastRenderedLyrics !== "") {
                lyricsOverlay.innerHTML = '';
                lastRenderedLyrics = "";
            }
        }
    }

    function gameLoop() {
        if (isPlaying) {
            const now = performance.now();
            const delta = (now - lastFrameTime) / 1000;
            lastFrameTime = now;
            
            masterTime += delta;
            updatePreviewAtTime(masterTime);
            
            requestAnimationFrame(gameLoop);
        }
    }

    btnPlayPause.addEventListener('click', () => {
        if (!isPlaying) {
            isPlaying = true;
            lastFrameTime = performance.now();
            
            // Forzar actualización inicial
            updatePreviewAtTime(masterTime);
            
            // Solo darle play a los elementos de HTML5 nativos si realmente hay un bloque en ese momento.
            // Si el masterTime avanza y entra en un bloque, el updatePreviewAtTime moverá el currentTime, 
            // pero HTML5 necesita que su estado sea play(). Lo forzamos a play siempre, pero lo silenciamos si no hay bloque.
            previewVideo.play().catch(e=>{});
            previewAudio.play().catch(e=>{});
            
            btnPlayPause.textContent = '⏸';
            requestAnimationFrame(gameLoop);
        } else {
            isPlaying = false;
            previewAudio.pause();
            previewVideo.pause();
            btnPlayPause.textContent = '▶';
        }
    });
    
    // --- RENDER FINAL ---
    btnRender.addEventListener('click', async () => {
        if (!currentJobId || !uploadedBgPath) {
            renderStatus.textContent = 'Sube un video primero.';
            return;
        }

        const duration = parseFloat(exportDuration.value);
        btnRender.disabled = true;
        btnRender.textContent = 'Renderizando...';
        renderStatus.textContent = 'Iniciando renderizado con FFmpeg...';

        try {
            const res = await fetch('/api/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_id: currentJobId,
                    bg_path: uploadedBgPath,
                    start_time: 0,
                    duration: duration,
                    tracks: tracks // We will parse this in python later
                })
            });
            const data = await res.json();
            
            let dots = 0;
            const result = await pollStatus(data.render_id, (status) => {
                dots = (dots + 1) % 4;
                renderStatus.textContent = 'Procesando video' + '.'.repeat(dots);
            });
            
            btnDownload.href = `/api/download/${data.render_id}`;
            btnDownload.style.display = 'block';
            const downloadHint = document.getElementById('download-hint');
            if(downloadHint) downloadHint.style.display = 'block';
            renderStatus.textContent = '¡Renderizado completado con éxito!';
        } catch (err) {
            renderStatus.textContent = `Error: ${err.message}`;
        } finally {
            btnRender.disabled = false;
            btnRender.textContent = 'Generar Video HD';
        }
    });
});
