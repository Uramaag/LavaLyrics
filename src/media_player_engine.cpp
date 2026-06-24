#include "media_player_engine.h"
#include <QDebug>
#include <QFileInfo>
#include <cmath>

// FFmpeg includes if available
#ifdef FFMPEG_AVAILABLE
extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
#include <libavutil/imgutils.h>
}
#endif

MediaPlayerEngine::MediaPlayerEngine(QObject *parent)
    : QObject(parent)
    , m_duration(0.0)
    , m_position(0.0)
    , m_isPlaying(false)
    , m_volume(1.0)
    , m_seekBase(0.0)
    , m_playbackTimer(new QTimer(this))
#ifdef FFMPEG_AVAILABLE
    , m_formatCtx(nullptr)
    , m_videoCodecCtx(nullptr)
    , m_audioCodecCtx(nullptr)
    , m_swsCtx(nullptr)
    , m_videoStreamIdx(-1)
    , m_audioStreamIdx(-1)
    , m_frame(nullptr)
    , m_frameRGB(nullptr)
#endif
{
    m_playbackTimer->setInterval(33); // ~30fps tick
    connect(m_playbackTimer, &QTimer::timeout, this, &MediaPlayerEngine::onPlaybackTick);
}

MediaPlayerEngine::~MediaPlayerEngine()
{
#ifdef FFMPEG_AVAILABLE
    closeMedia();
#endif
}

// ── Properties ────────────────────────────────────────────────────────────────

QString MediaPlayerEngine::mediaPath() const { return m_mediaPath; }

void MediaPlayerEngine::setMediaPath(const QString &path)
{
    if (m_mediaPath != path) {
        m_mediaPath = path;
        emit mediaPathChanged();
        loadMedia(path);
    }
}

double MediaPlayerEngine::duration()  const { return m_duration; }
double MediaPlayerEngine::position()  const { return m_position; }
bool   MediaPlayerEngine::isPlaying() const { return m_isPlaying; }
double MediaPlayerEngine::volume()    const { return m_volume; }

void MediaPlayerEngine::setIsPlaying(bool playing)
{
    if (m_isPlaying != playing) {
        m_isPlaying = playing;
        emit isPlayingChanged();
        if (playing) play(); else pause();
    }
}

void MediaPlayerEngine::setVolume(double v)
{
    double clamped = qBound(0.0, v, 1.0);
    if (!qFuzzyCompare(m_volume, clamped)) {
        m_volume = clamped;
        emit volumeChanged();
    }
}

// ── Public Invokables ─────────────────────────────────────────────────────────

bool MediaPlayerEngine::loadMedia(const QString &path)
{
    if (path.isEmpty()) return false;

    stop();

    qDebug() << "[MediaPlayerEngine] Loading:" << path;

#ifdef FFMPEG_AVAILABLE
    closeMedia();

    // Open format context
    if (avformat_open_input(&m_formatCtx, path.toUtf8().constData(), nullptr, nullptr) < 0) {
        qWarning() << "[MediaPlayerEngine] avformat_open_input failed for:" << path;
        emit errorOccurred("No se pudo abrir el archivo: " + path);
        emit mediaLoaded(false, path);
        return false;
    }

    if (avformat_find_stream_info(m_formatCtx, nullptr) < 0) {
        qWarning() << "[MediaPlayerEngine] avformat_find_stream_info failed";
        emit errorOccurred("No se pudo leer la información del stream");
        emit mediaLoaded(false, path);
        return false;
    }

    m_duration = m_formatCtx->duration / (double)AV_TIME_BASE;

    // Find video and audio streams
    m_videoStreamIdx = -1;
    m_audioStreamIdx = -1;
    for (unsigned i = 0; i < m_formatCtx->nb_streams; ++i) {
        AVMediaType type = m_formatCtx->streams[i]->codecpar->codec_type;
        if (type == AVMEDIA_TYPE_VIDEO && m_videoStreamIdx < 0) m_videoStreamIdx = (int)i;
        if (type == AVMEDIA_TYPE_AUDIO && m_audioStreamIdx < 0) m_audioStreamIdx = (int)i;
    }

    // Open video decoder
    if (m_videoStreamIdx >= 0) {
        AVCodecParameters *par = m_formatCtx->streams[m_videoStreamIdx]->codecpar;
        const AVCodec *codec = avcodec_find_decoder(par->codec_id);
        m_videoCodecCtx = avcodec_alloc_context3(codec);
        avcodec_parameters_to_context(m_videoCodecCtx, par);
        avcodec_open2(m_videoCodecCtx, codec, nullptr);

        m_frame    = av_frame_alloc();
        m_frameRGB = av_frame_alloc();
    }

    qDebug() << "[MediaPlayerEngine] Loaded successfully. Duration:" << m_duration << "s";
#else
    // Simulation fallback — reads file size to fake a duration
    QFileInfo fi(path);
    if (!fi.exists()) {
        emit errorOccurred("Archivo no encontrado: " + path);
        emit mediaLoaded(false, path);
        return false;
    }
    // Approximate: typical 128kbps MP3 → ~1MB per minute
    m_duration = qMax(10.0, (double)fi.size() / 16000.0);
    qDebug() << "[MediaPlayerEngine] Simulated duration:" << m_duration << "s for" << fi.fileName();
#endif

    m_position = 0.0;
    emit durationChanged();
    emit positionChanged();
    emit mediaLoaded(true, path);
    return true;
}

void MediaPlayerEngine::play()
{
    if (m_duration <= 0) return;
    m_seekBase = m_position;
    m_elapsedTimer.restart();
    m_playbackTimer->start();

    if (!m_isPlaying) {
        m_isPlaying = true;
        emit isPlayingChanged();
    }
    qDebug() << "[MediaPlayerEngine] Playing from" << m_position << "s";
}

void MediaPlayerEngine::pause()
{
    m_playbackTimer->stop();
    if (m_isPlaying) {
        m_isPlaying = false;
        emit isPlayingChanged();
    }
    qDebug() << "[MediaPlayerEngine] Paused at" << m_position << "s";
}

void MediaPlayerEngine::stop()
{
    m_playbackTimer->stop();
    m_position  = 0.0;
    m_isPlaying = false;
    m_seekBase  = 0.0;
    emit positionChanged();
    emit isPlayingChanged();
}

void MediaPlayerEngine::seek(double seconds)
{
    double clamped = qBound(0.0, seconds, m_duration);
    m_position  = clamped;
    m_seekBase  = clamped;

    if (m_isPlaying) m_elapsedTimer.restart();

#ifdef FFMPEG_AVAILABLE
    if (m_formatCtx) {
        int64_t ts = (int64_t)(clamped * AV_TIME_BASE);
        av_seek_frame(m_formatCtx, -1, ts, AVSEEK_FLAG_BACKWARD);
        if (m_videoCodecCtx) avcodec_flush_buffers(m_videoCodecCtx);
    }
#endif

    emit positionChanged();

    // Emit a frame at the new position
    QImage frame = getFrameAt(clamped);
    if (!frame.isNull()) emit frameReady(frame);
}

QImage MediaPlayerEngine::getFrameAt(double seconds)
{
#ifdef FFMPEG_AVAILABLE
    return decodeFrameAt(seconds);
#else
    Q_UNUSED(seconds)
    // Generate a placeholder dark frame with time overlay
    QImage img(540, 960, QImage::Format_RGB32);
    img.fill(QColor(15, 15, 15));
    return img;
#endif
}

QString MediaPlayerEngine::formatTime(double seconds) const
{
    int s = (int)seconds;
    int h = s / 3600;
    int m = (s % 3600) / 60;
    int sec = s % 60;
    if (h > 0)
        return QString("%1:%2:%3").arg(h).arg(m, 2, 10, QChar('0')).arg(sec, 2, 10, QChar('0'));
    return QString("%1:%2").arg(m, 2, 10, QChar('0')).arg(sec, 2, 10, QChar('0'));
}

// ── Private Slots ─────────────────────────────────────────────────────────────

void MediaPlayerEngine::onPlaybackTick()
{
    if (!m_isPlaying) return;

    double elapsed = m_elapsedTimer.elapsed() / 1000.0;
    double newPos  = m_seekBase + elapsed;

    if (newPos >= m_duration) {
        // End of media
        m_position = m_duration;
        emit positionChanged();
        stop();
        return;
    }

    if (std::abs(newPos - m_position) > 0.001) {
        m_position = newPos;
        emit positionChanged();

        // Decode and emit frame every ~100ms (10fps for preview)
        static int tickCount = 0;
        if (++tickCount % 3 == 0) {
            QImage frame = getFrameAt(m_position);
            if (!frame.isNull()) emit frameReady(frame);
        }
    }
}

// ── FFmpeg Private ─────────────────────────────────────────────────────────────

#ifdef FFMPEG_AVAILABLE
void MediaPlayerEngine::closeMedia()
{
    if (m_swsCtx)       { sws_freeContext(m_swsCtx); m_swsCtx = nullptr; }
    if (m_frame)        { av_frame_free(&m_frame); }
    if (m_frameRGB)     { av_frame_free(&m_frameRGB); }
    if (m_videoCodecCtx){ avcodec_free_context(&m_videoCodecCtx); }
    if (m_audioCodecCtx){ avcodec_free_context(&m_audioCodecCtx); }
    if (m_formatCtx)    { avformat_close_input(&m_formatCtx); }
    m_videoStreamIdx = -1;
    m_audioStreamIdx = -1;
}

QImage MediaPlayerEngine::decodeFrameAt(double seconds)
{
    if (!m_formatCtx || m_videoStreamIdx < 0) return QImage();

    int64_t ts = (int64_t)(seconds * AV_TIME_BASE);
    av_seek_frame(m_formatCtx, -1, ts, AVSEEK_FLAG_BACKWARD);
    avcodec_flush_buffers(m_videoCodecCtx);

    AVPacket *pkt = av_packet_alloc();
    QImage result;

    while (av_read_frame(m_formatCtx, pkt) >= 0) {
        if (pkt->stream_index == m_videoStreamIdx) {
            if (avcodec_send_packet(m_videoCodecCtx, pkt) == 0) {
                if (avcodec_receive_frame(m_videoCodecCtx, m_frame) == 0) {
                    int w = m_videoCodecCtx->width;
                    int h = m_videoCodecCtx->height;

                    if (!m_swsCtx) {
                        m_swsCtx = sws_getContext(w, h, m_videoCodecCtx->pix_fmt,
                                                   w, h, AV_PIX_FMT_RGB32,
                                                   SWS_BILINEAR, nullptr, nullptr, nullptr);
                    }

                    QImage img(w, h, QImage::Format_RGB32);
                    uint8_t *dst[1]    = { img.bits() };
                    int      dstStride[1] = { (int)img.bytesPerLine() };
                    sws_scale(m_swsCtx, m_frame->data, m_frame->linesize, 0, h, dst, dstStride);
                    result = img;
                    av_packet_unref(pkt);
                    break;
                }
            }
        }
        av_packet_unref(pkt);
    }

    av_packet_free(&pkt);
    return result;
}
#endif
