#ifndef MEDIA_PLAYER_ENGINE_H
#define MEDIA_PLAYER_ENGINE_H

#include <QObject>
#include <QString>
#include <QImage>
#include <QTimer>
#include <QElapsedTimer>
#include <QUrl>

// Forward declare FFmpeg types to avoid header pollution
struct AVFormatContext;
struct AVCodecContext;
struct AVFrame;
struct SwsContext;

class MediaPlayerEngine : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString mediaPath READ mediaPath WRITE setMediaPath NOTIFY mediaPathChanged)
    Q_PROPERTY(double duration  READ duration  NOTIFY durationChanged)
    Q_PROPERTY(double position  READ position  NOTIFY positionChanged)
    Q_PROPERTY(bool   isPlaying READ isPlaying WRITE setIsPlaying NOTIFY isPlayingChanged)
    Q_PROPERTY(double volume    READ volume    WRITE setVolume    NOTIFY volumeChanged)

public:
    explicit MediaPlayerEngine(QObject *parent = nullptr);
    ~MediaPlayerEngine();

    QString mediaPath() const;
    void    setMediaPath(const QString &path);

    double duration() const;
    double position() const;
    bool   isPlaying() const;
    void   setIsPlaying(bool playing);
    double volume() const;
    void   setVolume(double v);

    Q_INVOKABLE bool    loadMedia(const QString &path);
    Q_INVOKABLE void    play();
    Q_INVOKABLE void    pause();
    Q_INVOKABLE void    stop();
    Q_INVOKABLE void    seek(double seconds);
    Q_INVOKABLE QImage  getFrameAt(double seconds);
    Q_INVOKABLE QString formatTime(double seconds) const;

signals:
    void mediaPathChanged();
    void durationChanged();
    void positionChanged();
    void isPlayingChanged();
    void volumeChanged();
    void frameReady(const QImage &frame);
    void mediaLoaded(bool success, const QString &path);
    void errorOccurred(const QString &msg);

private slots:
    void onPlaybackTick();

private:
    // Qt state
    QString        m_mediaPath;
    double         m_duration;
    double         m_position;
    bool           m_isPlaying;
    double         m_volume;
    QTimer        *m_playbackTimer;
    QElapsedTimer  m_elapsedTimer;
    double         m_seekBase;

    // FFmpeg state (conditionally compiled)
#ifdef FFMPEG_AVAILABLE
    AVFormatContext *m_formatCtx;
    AVCodecContext  *m_videoCodecCtx;
    AVCodecContext  *m_audioCodecCtx;
    SwsContext      *m_swsCtx;
    int              m_videoStreamIdx;
    int              m_audioStreamIdx;
    AVFrame         *m_frame;
    AVFrame         *m_frameRGB;

    void closeMedia();
    QImage decodeFrameAt(double seconds);
#endif
};

#endif // MEDIA_PLAYER_ENGINE_H
