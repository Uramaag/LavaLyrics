#include "timeline_controller.h"
#include <QUuid>
#include <QSet>
#include <algorithm>
#include <cmath>

TimelineController::TimelineController(QObject *parent)
    : QObject(parent), m_masterTime(0.0), m_isPlaying(false)
{
}

double TimelineController::masterTime() const { return m_masterTime; }

void TimelineController::setMasterTime(double t)
{
    if (std::abs(m_masterTime - t) > 0.001) {
        m_masterTime = std::max(0.0, t);
        emit masterTimeChanged();
    }
}

bool TimelineController::isPlaying() const { return m_isPlaying; }

void TimelineController::setIsPlaying(bool playing)
{
    if (m_isPlaying != playing) {
        m_isPlaying = playing;
        emit isPlayingChanged();
    }
}

QString TimelineController::normalizeTrackId(const QString &trackName, const QString &type) const
{
    QString t = trackName.trimmed().toUpper();
    if (t == "VIDEO" || t == "LYRICS") return "V1";
    if (t == "AUDIO") return "A1";
    if (t.startsWith("V") || t.startsWith("A")) return t;
    if (type == "audio") return "A1";
    return "V1";
}

QString TimelineController::trackTypeForTrackId(const QString &trackId) const
{
    return trackId.toUpper().startsWith("A") ? "audio" : "video";
}

int TimelineController::layerForTrackId(const QString &trackId) const
{
    bool ok = false;
    int n = trackId.mid(1).toInt(&ok);
    return ok ? std::max(0, n - 1) : 0;
}

QString TimelineController::makeId(const QString &prefix) const
{
    return prefix + "-" + QUuid::createUuid().toString(QUuid::WithoutBraces);
}

Clip *TimelineController::findClip(const QString &clipId)
{
    for (auto &clip : m_clips) {
        if (clip.id == clipId) return &clip;
    }
    return nullptr;
}

const Clip *TimelineController::findClipConst(const QString &clipId) const
{
    for (const auto &clip : m_clips) {
        if (clip.id == clipId) return &clip;
    }
    return nullptr;
}

QVariantMap TimelineController::clipToMap(const Clip &clip) const
{
    QVariantMap map = clip.props;
    map["id"] = clip.id;
    map["type"] = clip.type;
    map["trackType"] = clip.trackType;
    map["trackId"] = clip.trackId;
    map["name"] = clip.name;
    map["path"] = clip.path;
    map["proxyPath"] = clip.proxyPath;
    map["groupId"] = clip.groupId;
    map["grouped"] = clip.grouped;
    map["start"] = clip.start;
    map["duration"] = clip.duration;
    map["mediaStart"] = clip.mediaStart;
    map["layer"] = clip.layer;
    return map;
}

void TimelineController::addClip(const QString &trackName, const QString &id, const QString &type, double start, double duration, double mediaStart, int layer)
{
    QString trackId = normalizeTrackId(trackName, type);
    Clip clip;
    clip.id = id.isEmpty() ? makeId(type) : id;
    clip.type = type;
    clip.trackType = trackTypeForTrackId(trackId);
    clip.trackId = trackId;
    clip.name = id.section('/', -1).section('\\', -1);
    clip.path = id;
    clip.grouped = false;
    clip.start = std::max(0.0, start);
    clip.duration = std::max(0.01, duration);
    clip.mediaStart = std::max(0.0, mediaStart);
    clip.layer = layer;
    m_clips.append(clip);
    emit clipsChanged(trackName);
    emit clipsChanged(trackId);
}

QString TimelineController::addMediaClip(const QString &trackIdArg, const QString &type, const QString &name, const QString &path, double start, double duration, double mediaStart)
{
    QString trackId = normalizeTrackId(trackIdArg, type);
    Clip clip;
    clip.id = makeId(type);
    clip.type = type;
    clip.trackType = trackTypeForTrackId(trackId);
    clip.trackId = trackId;
    clip.name = name.isEmpty() ? path.section('/', -1).section('\\', -1) : name;
    clip.path = path;
    clip.grouped = false;
    clip.start = std::max(0.0, start);
    clip.duration = std::max(0.01, duration);
    clip.mediaStart = std::max(0.0, mediaStart);
    clip.layer = layerForTrackId(trackId);
    clip.props["opacity"] = 1.0;
    clip.props["scale"] = 1.0;
    clip.props["rotation"] = 0.0;
    clip.props["x"] = 0.0;
    clip.props["y"] = 0.0;
    clip.props["loopMode"] = "Normal";
    clip.props["volume"] = 1.0;
    m_clips.append(clip);
    emit clipsChanged(trackId);
    emit clipsChanged(clip.trackType);
    return clip.id;
}

QString TimelineController::addAdjustmentClip(const QString &trackIdArg, const QString &name, double start, double duration, const QVariantMap &props)
{
    QString trackId = normalizeTrackId(trackIdArg, "adjustment");
    Clip clip;
    clip.id = makeId("adjustment");
    clip.type = "adjustment";
    clip.trackType = "video";
    clip.trackId = trackId.startsWith("A") ? "V2" : trackId;
    clip.name = name.isEmpty() ? "Capa de ajuste" : name;
    clip.grouped = false;
    clip.start = std::max(0.0, start);
    clip.duration = std::max(0.01, duration);
    clip.mediaStart = 0.0;
    clip.layer = layerForTrackId(clip.trackId);
    clip.props = props;
    if (!clip.props.contains("effect")) clip.props["effect"] = "eq";
    if (!clip.props.contains("brightness")) clip.props["brightness"] = 0.0;
    if (!clip.props.contains("contrast")) clip.props["contrast"] = 1.0;
    if (!clip.props.contains("saturation")) clip.props["saturation"] = 1.0;
    m_clips.append(clip);
    emit clipsChanged(clip.trackId);
    emit clipsChanged("video");
    return clip.id;
}

QString TimelineController::addSongClips(const QString &name, const QString &audioPath, const QString &lyricsPath, double start, double duration, const QVariantList &lyrics)
{
    QString groupId = makeId("group");
    QString audioId = addMediaClip("A1", "audio", name, audioPath, start, duration, 0.0);
    if (Clip *audio = findClip(audioId)) {
        audio->groupId = groupId;
        audio->grouped = true;
    }

    if (!lyricsPath.isEmpty() || !lyrics.isEmpty()) {
        QString lyricsId = addMediaClip("V2", "lyrics", name + " Lyrics", lyricsPath, start, duration, 0.0);
        if (Clip *lyric = findClip(lyricsId)) {
            lyric->groupId = groupId;
            lyric->grouped = true;
            lyric->props["lyricsPath"] = lyricsPath;
            lyric->props["lyrics"] = lyrics;
            lyric->props["opacity"] = 1.0;
        }
    }
    emit clipsChanged("audio");
    emit clipsChanged("video");
    return groupId;
}

void TimelineController::moveClip(const QString &, const QString &clipId, double newStart)
{
    moveClipById(clipId, newStart);
}

void TimelineController::moveClipById(const QString &clipId, double newStart)
{
    Clip *target = findClip(clipId);
    if (!target) return;

    double snappedStart = std::max(0.0, newStart);
    double shift = snappedStart - target->start;
    QString groupId = target->grouped ? target->groupId : QString();
    QSet<QString> changedTracks;

    for (auto &clip : m_clips) {
        if (clip.id == clipId || (!groupId.isEmpty() && clip.grouped && clip.groupId == groupId)) {
            clip.start = std::max(0.0, clip.start + shift);
            changedTracks.insert(clip.trackId);
            changedTracks.insert(clip.trackType);
        }
    }
    for (const QString &track : changedTracks) emit clipsChanged(track);
}

void TimelineController::cutClip(const QString &, const QString &clipId, double cutTimeInClip)
{
    Clip *clip = findClip(clipId);
    if (!clip || cutTimeInClip < 0.1 || cutTimeInClip > clip->duration - 0.1) return;

    Clip right = *clip;
    right.id = makeId(clip->type);
    right.start += cutTimeInClip;
    right.duration -= cutTimeInClip;
    right.mediaStart += cutTimeInClip;
    right.grouped = false;
    right.groupId.clear();
    clip->duration = cutTimeInClip;
    m_clips.append(right);
    emit clipsChanged(clip->trackId);
    emit clipsChanged(clip->trackType);
}

void TimelineController::deleteClip(const QString &, const QString &clipId)
{
    Clip *target = findClip(clipId);
    if (!target) return;
    QString groupId = target->grouped ? target->groupId : QString();
    QStringList changed;
    for (const auto &clip : m_clips) {
        if (clip.id == clipId || (!groupId.isEmpty() && clip.grouped && clip.groupId == groupId)) {
            changed << clip.trackId << clip.trackType;
        }
    }
    m_clips.erase(std::remove_if(m_clips.begin(), m_clips.end(), [&](const Clip &clip) {
        return clip.id == clipId || (!groupId.isEmpty() && clip.grouped && clip.groupId == groupId);
    }), m_clips.end());
    for (const QString &track : changed) emit clipsChanged(track);
}

void TimelineController::ungroupClip(const QString &clipId)
{
    const Clip *target = findClipConst(clipId);
    if (!target || target->groupId.isEmpty()) return;
    QString groupId = target->groupId;
    for (auto &clip : m_clips) {
        if (clip.groupId == groupId) {
            clip.grouped = false;
            clip.groupId.clear();
            emit clipsChanged(clip.trackId);
        }
    }
}

void TimelineController::groupClips(const QStringList &clipIds)
{
    QString groupId = makeId("group");
    for (auto &clip : m_clips) {
        if (clipIds.contains(clip.id)) {
            clip.groupId = groupId;
            clip.grouped = true;
            emit clipsChanged(clip.trackId);
        }
    }
}

void TimelineController::setClipProperty(const QString &clipId, const QString &key, const QVariant &value)
{
    if (Clip *clip = findClip(clipId)) {
        clip->props[key] = value;
        emit clipsChanged(clip->trackId);
        emit clipsChanged(clip->trackType);
    }
}

QVariantMap TimelineController::getClip(const QString &clipId) const
{
    const Clip *clip = findClipConst(clipId);
    return clip ? clipToMap(*clip) : QVariantMap();
}

QVariantList TimelineController::getClips(const QString &trackName) const
{
    QString trackId = normalizeTrackId(trackName);
    if (trackName == "video") return getVideoClips();
    if (trackName == "audio") return getAudioClips();
    if (trackName == "lyrics") {
        QVariantList list;
        for (const auto &clip : m_clips) {
            if (clip.type == "lyrics") list.append(clipToMap(clip));
        }
        return list;
    }
    return getTrackClips(trackId);
}

QVariantList TimelineController::getTrackClips(const QString &trackIdArg) const
{
    QString trackId = normalizeTrackId(trackIdArg);
    QVariantList list;
    for (const auto &clip : m_clips) {
        if (clip.trackId == trackId) list.append(clipToMap(clip));
    }
    return list;
}

QVariantList TimelineController::getVideoClips() const
{
    QVariantList list;
    for (const auto &clip : m_clips) {
        if (clip.trackType == "video") list.append(clipToMap(clip));
    }
    return list;
}

QVariantList TimelineController::getAudioClips() const
{
    QVariantList list;
    for (const auto &clip : m_clips) {
        if (clip.trackType == "audio") list.append(clipToMap(clip));
    }
    return list;
}

QVariantList TimelineController::getTracks(const QString &trackType) const
{
    QVariantList tracks;
    if (trackType == "audio") {
        for (int i = 1; i <= 3; ++i) {
            QVariantMap t; t["id"] = "A" + QString::number(i); t["name"] = "A" + QString::number(i); t["type"] = "audio";
            tracks.append(t);
        }
    } else {
        for (int i = 3; i >= 1; --i) {
            QVariantMap t; t["id"] = "V" + QString::number(i); t["name"] = "V" + QString::number(i); t["type"] = "video";
            tracks.append(t);
        }
    }
    return tracks;
}

void TimelineController::clear()
{
    m_clips.clear();
    emit clipsChanged("video");
    emit clipsChanged("audio");
    emit clipsChanged("lyrics");
}
