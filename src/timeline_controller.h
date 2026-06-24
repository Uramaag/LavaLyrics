#ifndef TIMELINE_CONTROLLER_H
#define TIMELINE_CONTROLLER_H

#include <QObject>
#include <QString>
#include <QList>
#include <QVariantMap>

struct Clip {
    QString id;
    QString type;      // "audio", "video", "lyrics"
    double start;      // timeline start time in seconds
    double duration;   // duration in seconds
    double mediaStart; // clip start offset within media file in seconds
    int layer;         // layer index for video track
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
    Q_INVOKABLE void moveClip(const QString &trackName, const QString &clipId, double newStart);
    Q_INVOKABLE void cutClip(const QString &trackName, const QString &clipId, double cutTimeInClip);
    Q_INVOKABLE void deleteClip(const QString &trackName, const QString &clipId);
    Q_INVOKABLE QVariantList getClips(const QString &trackName) const;

signals:
    void masterTimeChanged();
    void isPlayingChanged();
    void clipsChanged(const QString &trackName);

private:
    double m_masterTime;
    bool m_isPlaying;
    QList<Clip> m_audioClips;
    QList<Clip> m_videoClips;
    QList<Clip> m_lyricsClips;

    QList<Clip>& getTrackList(const QString &trackName);
    const QList<Clip>& getTrackListConst(const QString &trackName) const;
};

#endif // TIMELINE_CONTROLLER_H
