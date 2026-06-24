#include <QApplication>
#include <QQmlApplicationEngine>
#include <QQuickWindow>
#include <iostream>
#include "timeline_controller.h"
#include "media_player_engine.h"
#include "video_exporter.h"

int main(int argc, char *argv[])
{
#if QT_VERSION < QT_VERSION_CHECK(6, 0, 0)
    QCoreApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
#endif

    QApplication app(argc, argv);

    // Register C++ types in QML context
    qmlRegisterType<TimelineController>("LavaLyrics", 1, 0, "TimelineController");
    qmlRegisterType<MediaPlayerEngine>("LavaLyrics", 1, 0, "MediaPlayerEngine");
    qmlRegisterType<VideoExporter>("LavaLyrics", 1, 0, "VideoExporter");

    QQmlApplicationEngine engine;
    const QUrl url(QStringLiteral("qrc:/main.qml"));
    
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreated,
                     &app, [url](QObject *obj, const QUrl &objUrl) {
        if (!obj && url == objUrl)
            QCoreApplication::exit(-1);
    }, Qt::QueuedConnection);
    
    engine.load(url);

    std::cout << "[LavaLyrics C++] Engine loaded successfully. Starting GUI main loop..." << std::endl;

    return app.exec();
}
