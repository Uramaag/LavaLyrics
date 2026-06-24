#include "media_player_engine.h"
#include <QDebug>

// Conditionally include FFmpeg headers if available
extern "C" {
#ifdef FFMPEG_AVAILABLE
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libswscale/swscale.h>
#endif
}

MediaPlayerEngine::MediaPlayerEngine(QObject *parent)
    : QObject(parent), m_duration(0.0)
{
}

MediaPlayerEngine::~MediaPlayerEngine()
{
}

QString MediaPlayerEngine::mediaPath() const
{
    return m_mediaPath;
}

void MediaPlayerEngine::setMediaPath(const QString &path)
{
    if (m_mediaPath != path) {
        m_mediaPath = path;
        emit mediaPathChanged();
        loadMedia(path);
    }
}

double MediaPlayerEngine::duration() const
{
    return m_duration;
}

bool MediaPlayerEngine::loadMedia(const QString &path)
{
    qDebug() << "[MediaPlayerEngine] Loading media from path:" << path;
    
    // In a fully configured environment, this performs avformat_open_input
#ifdef FFMPEG_AVAILABLE
    // AVFormatContext* formatCtx = nullptr;
    // if (avformat_open_input(&formatCtx, path.toUtf8().constData(), nullptr, nullptr) < 0) {
    //     return false;
    // }
#endif

    m_duration = 180.0; // Simulated duration
    emit durationChanged();
    return true;
}

void MediaPlayerEngine::seek(double seconds)
{
    qDebug() << "[MediaPlayerEngine] Seeking to:" << seconds << "seconds";
    QImage mockFrame(1080, 1920, QImage::Format_RGB32);
    mockFrame.fill(Qt::black);
    emit frameReady(mockFrame);
}

QImage MediaPlayerEngine::getFrameAt(double seconds)
{
    Q_UNUSED(seconds);
    QImage mockFrame(1080, 1920, QImage::Format_RGB32);
    mockFrame.fill(Qt::darkGray);
    return mockFrame;
}
