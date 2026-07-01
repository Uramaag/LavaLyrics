#ifndef TIMELINE_CONTROLLER_H
#define TIMELINE_CONTROLLER_H

#include <QObject>
#include <QString>
#include <QList>
#include <QVariantMap>
#include <QVariantList>

struct Clip {
    QString id;
    QString type;       // "audio", "video", "lyrics", "adjustment"
    QString trackType;  // "video" or "audio"
    QString trackId;    // "V1", "V2", "A1", ...
    QString name;
    QString path;
    QString proxyPath;
    QString groupId;
    bool grouped;
    double start;       // timeline start time in seconds
    double duration;    // duration in seconds
    double mediaStart;  // clip start offset within media file in seconds
    int layer;          // numeric layer for compatibility
    QVariantMap props;  // transform, loop, volume, effect params, lyrics metadata
};

class TimelineController : public QObject
{
    Q_OBJECT
    Q_PROPERTY(double masterTime READ masterTime WRITE setMasterTime NOTIFY masterTimeChanged)
    Q_PROPERTY(bool isPlaying READ isPlaying WRITE setIsPlaying NOTIFY isPlayingChanged)

public:
    explicit TimelineController(QObject *parent = nullptr);

    double masterTime() const;
    void setMasterTime(double t);

    bool isPlaying() const;
    void setIsPlaying(bool playing);

    Q_INVOKABLE void addClip(const QString &trackName, const QString &id, const QString &type, double start, double duration, double mediaStart, int layer = 0);
    Q_INVOKABLE QString addMediaClip(const QString &trackId, const QString &type, const QString &name, const QString &path, double start, double duration, double mediaStart = 0.0);
    Q_INVOKABLE QString addAdjustmentClip(const QString &trackId, const QString &name, double start, double duration, const QVariantMap &props = QVariantMap());
    Q_INVOKABLE QString addSongClips(const QString &name, const QString &audioPath, const QString &lyricsPath, double start, double duration, const QVariantList &lyrics = QVariantList());
    Q_INVOKABLE void moveClip(const QString &trackName, const QString &clipId, double newStart);
    Q_INVOKABLE void moveClipById(const QString &clipId, double newStart);
    Q_INVOKABLE void cutClip(const QString &trackName, const QString &clipId, double cutTimeInClip);
    Q_INVOKABLE void deleteClip(const QString &trackName, const QString &clipId);
    Q_INVOKABLE void ungroupClip(const QString &clipId);
    Q_INVOKABLE void groupClips(const QStringList &clipIds);
    Q_INVOKABLE void setClipProperty(const QString &clipId, const QString &key, const QVariant &value);
    Q_INVOKABLE QVariantMap getClip(const QString &clipId) const;
    Q_INVOKABLE QVariantList getClips(const QString &trackName) const;
    Q_INVOKABLE QVariantList getTrackClips(const QString &trackId) const;
    Q_INVOKABLE QVariantList getVideoClips() const;
    Q_INVOKABLE QVariantList getAudioClips() const;
    Q_INVOKABLE QVariantList getTracks(const QString &trackType) const;
    Q_INVOKABLE void clear();

signals:
    void masterTimeChanged();
    void isPlayingChanged();
    void clipsChanged(const QString &trackName);

private:
    double m_masterTime;
    bool m_isPlaying;
    QList<Clip> m_clips;

    QString normalizeTrackId(const QString &trackName, const QString &type = QString()) const;
    QString trackTypeForTrackId(const QString &trackId) const;
    int layerForTrackId(const QString &trackId) const;
    QString makeId(const QString &prefix) const;
    Clip *findClip(const QString &clipId);
    const Clip *findClipConst(const QString &clipId) const;
    QVariantMap clipToMap(const Clip &clip) const;
};

#endif // TIMELINE_CONTROLLER_H
