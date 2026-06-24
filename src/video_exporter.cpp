#include "video_exporter.h"
#include <QDebug>
#include <QThread>

VideoExporter::VideoExporter(QObject *parent)
    : QObject(parent), m_progress(0.0), m_isRunning(false)
{
}

VideoExporter::~VideoExporter()
{
}

double VideoExporter::progress() const
{
    return m_progress;
}

bool VideoExporter::isRunning() const
{
    return m_isRunning;
}

bool VideoExporter::startExport(const QString &outputPath, const QVariantMap &exportSettings, const QVariantMap &tracks)
{
    qDebug() << "[VideoExporter] Starting export to:" << outputPath;
    qDebug() << "[VideoExporter] Resolution settings:" << exportSettings["resolution"].toString();
    
    if (m_isRunning) return false;

    m_isRunning = true;
    m_progress = 0.0;
    emit isRunningChanged();
    emit progressChanged();

    // In a production layout, this runs in a worker thread and encodes video frames with FFmpeg APIs
    // e.g. using avcodec_send_frame and av_write_frame.
    // For demonstration, we simulate rendering progress:
    QThread* thread = QThread::create([this, outputPath]() {
        for (int i = 1; i <= 10; ++i) {
            QThread::msleep(300);
            m_progress = i * 10.0;
            emit progressChanged();
        }
        m_isRunning = false;
        emit isRunningChanged();
        emit exportCompleted(outputPath);
    });
    
    thread->start();
    return true;
}

void VideoExporter::cancelExport()
{
    qDebug() << "[VideoExporter] Cancelling active export process";
    if (m_isRunning) {
        m_isRunning = false;
        m_progress = 0.0;
        emit isRunningChanged();
        emit progressChanged();
        emit exportFailed("Exportacion cancelada por el usuario");
    }
}
