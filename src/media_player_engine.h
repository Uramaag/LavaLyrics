#ifndef MEDIA_PLAYER_ENGINE_H
#define MEDIA_PLAYER_ENGINE_H

#include <QObject>
#include <QString>
#include <QImage>

class MediaPlayerEngine : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString mediaPath READ mediaPath WRITE setMediaPath NOTIFY mediaPathChanged)
    Q_PROPERTY(double duration READ duration NOTIFY durationChanged)

public:
    explicit MediaPlayerEngine(QObject *parent = nullptr);
    ~MediaPlayerEngine();

    QString mediaPath() const;
    void setMediaPath(const QString &path);

    double duration() const;

    Q_INVOKABLE bool loadMedia(const QString &path);
    Q_INVOKABLE void seek(double seconds);
    Q_INVOKABLE QImage getFrameAt(double seconds);

signals:
    void mediaPathChanged();
    void durationChanged();
    void frameReady(const QImage &frame);

private:
    QString m_mediaPath;
    double m_duration;

    // FFmpeg state variables will go here:
    // AVFormatContext* m_formatCtx;
    // AVCodecContext* m_codecCtx;
    // int m_videoStreamIdx;
};

#endif // MEDIA_PLAYER_ENGINE_H
