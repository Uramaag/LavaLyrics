#include "timeline_controller.h"
#include <algorithm>
#include <cmath>

TimelineController::TimelineController(QObject *parent)
    : QObject(parent), m_masterTime(0.0), m_isPlaying(false)
{
}

double TimelineController::masterTime() const
{
    return m_masterTime;
}

void TimelineController::setMasterTime(double t)
{
    if (std::abs(m_masterTime - t) > 0.001) {
        m_masterTime = std::max(0.0, t);
        emit masterTimeChanged();
    }
}

bool TimelineController::isPlaying() const
{
    return m_isPlaying;
}

void TimelineController::setIsPlaying(bool playing)
{
    if (m_isPlaying != playing) {
        m_isPlaying = playing;
        emit isPlayingChanged();
    }
}

QList<Clip>& TimelineController::getTrackList(const QString &trackName)
{
    if (trackName == "audio") return m_audioClips;
    if (trackName == "video") return m_videoClips;
    return m_lyricsClips;
}

const QList<Clip>& TimelineController::getTrackListConst(const QString &trackName) const
{
    if (trackName == "audio") return m_audioClips;
    if (trackName == "video") return m_videoClips;
    return m_lyricsClips;
}

void TimelineController::addClip(const QString &trackName, const QString &id, const QString &type, double start, double duration, double mediaStart, int layer)
{
    QList<Clip> &track = getTrackList(trackName);
    Clip c{id, type, start, duration, mediaStart, layer};
    track.append(c);
    emit clipsChanged(trackName);
}

void TimelineController::moveClip(const QString &trackName, const QString &clipId, double newStart)
{
    QList<Clip> &track = getTrackList(trackName);
    auto it = std::find_if(track.begin(), track.end(), [&](const Clip &c) { return c.id == clipId; });
    
    if (it != track.end()) {
        double snappedStart = std::max(0.0, newStart);
        double shift = snappedStart - it->start;
        
        if (trackName == "audio" || trackName == "lyrics") {
            // Shift both audio and lyrics tracks synchronized
            for (auto &c : m_audioClips) c.start += shift;
            for (auto &c : m_lyricsClips) c.start += shift;
            emit clipsChanged("audio");
            emit clipsChanged("lyrics");
        } else {
            it->start = snappedStart;
            emit clipsChanged(trackName);
        }
    }
}

void TimelineController::cutClip(const QString &trackName, const QString &clipId, double cutTimeInClip)
{
    QList<Clip> &track = getTrackList(trackName);
    
    if (trackName == "audio" || trackName == "lyrics") {
        auto aIt = std::find_if(m_audioClips.begin(), m_audioClips.end(), [&](const Clip &c) { return c.id == clipId; });
        auto lIt = std::find_if(m_lyricsClips.begin(), m_lyricsClips.end(), [&](const Clip &c) { return c.id == clipId; });
        
        if (aIt != m_audioClips.end() && lIt != m_lyricsClips.end()) {
            if (cutTimeInClip < 0.5 || cutTimeInClip > aIt->duration - 0.5) return;
            
            QString randId = QString::number(rand() / double(RAND_MAX));
            
            Clip rightAudio = *aIt;
            rightAudio.id = "audio-cut-" + randId;
            rightAudio.start += cutTimeInClip;
            rightAudio.duration -= cutTimeInClip;
            rightAudio.mediaStart += cutTimeInClip;
            
            aIt->duration = cutTimeInClip;
            m_audioClips.append(rightAudio);
            
            Clip rightLyrics = *lIt;
            rightLyrics.id = "lyrics-cut-" + randId;
            rightLyrics.start += cutTimeInClip;
            rightLyrics.duration -= cutTimeInClip;
            rightLyrics.mediaStart += cutTimeInClip;
            
            lIt->duration = cutTimeInClip;
            m_lyricsClips.append(rightLyrics);
            
            emit clipsChanged("audio");
            emit clipsChanged("lyrics");
        }
    } else {
        auto it = std::find_if(track.begin(), track.end(), [&](const Clip &c) { return c.id == clipId; });
        if (it != track.end()) {
            if (cutTimeInClip < 0.5 || cutTimeInClip > it->duration - 0.5) return;
            
            QString randId = QString::number(rand() / double(RAND_MAX));
            Clip right = *it;
            right.id = "clip-cut-" + randId;
            right.start += cutTimeInClip;
            right.duration -= cutTimeInClip;
            right.mediaStart += cutTimeInClip;
            
            it->duration = cutTimeInClip;
            track.append(right);
            
            emit clipsChanged(trackName);
        }
    }
}

void TimelineController::deleteClip(const QString &trackName, const QString &clipId)
{
    if (trackName == "audio" || trackName == "audio_lyrics") {
        // Delete audio and lyrics clips by index-based mapping
        int idx = -1;
        for (int i = 0; i < m_audioClips.size(); ++i) {
            if (m_audioClips[i].id == clipId) {
                idx = i;
                break;
            }
        }
        if (idx != -1 && idx < m_audioClips.size() && idx < m_lyricsClips.size()) {
            m_audioClips.removeAt(idx);
            m_lyricsClips.removeAt(idx);
            emit clipsChanged("audio");
            emit clipsChanged("lyrics");
        }
    } else {
        QList<Clip> &track = getTrackList(trackName);
        auto it = std::remove_if(track.begin(), track.end(), [&](const Clip &c) { return c.id == clipId; });
        if (it != track.end()) {
            track.erase(it, track.end());
            emit clipsChanged(trackName);
        }
    }
}

QVariantList TimelineController::getClips(const QString &trackName) const
{
    QVariantList list;
    const QList<Clip> &track = getTrackListConst(trackName);
    
    for (const auto &c : track) {
        QVariantMap map;
        map["id"] = c.id;
        map["type"] = c.type;
        map["start"] = c.start;
        map["duration"] = c.duration;
        map["mediaStart"] = c.mediaStart;
        map["layer"] = c.layer;
        list.append(map);
    }
    return list;
}
