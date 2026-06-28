#include <QApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickWindow>
#include <iostream>

#include "timeline_controller.h"
#include "media_player_engine.h"
#include "video_exporter.h"
#include "lyrics_loader.h"
#include "project_manager.h"
#include "downloader_bridge.h"

int main(int argc, char *argv[])
{
#if QT_VERSION < QT_VERSION_CHECK(6, 0, 0)
    QCoreApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
#endif

    QApplication app(argc, argv);
    app.setApplicationName("LavaLyrics");
    app.setOrganizationName("LavaLyrics");
    app.setApplicationVersion("1.0.0");

    // Register all C++ types for QML access
    qmlRegisterType<TimelineController>("LavaLyrics", 1, 0, "TimelineController");
    qmlRegisterType<MediaPlayerEngine> ("LavaLyrics", 1, 0, "MediaPlayerEngine");
    qmlRegisterType<VideoExporter>     ("LavaLyrics", 1, 0, "VideoExporter");
    qmlRegisterType<LyricsLoader>      ("LavaLyrics", 1, 0, "LyricsLoader");
    qmlRegisterType<ProjectManager>    ("LavaLyrics", 1, 0, "ProjectManager");
    qmlRegisterType<DownloaderBridge>  ("LavaLyrics", 1, 0, "DownloaderBridge");

    QQmlApplicationEngine engine;

    // Log QML engine warnings to console
    QObject::connect(&engine, &QQmlApplicationEngine::warnings, [](const QList<QQmlError> &warnings) {
        for (const auto &warning : warnings) {
            std::cerr << "[QML Warning] " << warning.toString().toStdString() << std::endl;
        }
    });

    // Expose app version to QML
    engine.rootContext()->setContextProperty("APP_VERSION", app.applicationVersion());

    const QUrl url(QStringLiteral("qrc:/main.qml"));

    QObject::connect(&engine, &QQmlApplicationEngine::objectCreated,
                     &app, [url](QObject *obj, const QUrl &objUrl) {
        if (!obj && url == objUrl) {
            std::cerr << "[LavaLyrics] Fatal: QML root object failed to create.\n";
            QCoreApplication::exit(-1);
        }
    }, Qt::QueuedConnection);

    engine.load(url);

    std::cout << "[LavaLyrics C++] Engine loaded. Starting main loop...\n";
    return app.exec();
}
