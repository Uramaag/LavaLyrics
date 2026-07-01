#include <QApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickWindow>
#include <QFile>
#include <QTextStream>
#include <QQuickGraphicsConfiguration>
#include <QQuickStyle>
#include <iostream>
#include <fstream>
#include <windows.h> // Para MessageBox nativo de Windows

#include "timeline_controller.h"
#include "media_player_engine.h"
#include "video_exporter.h"
#include "lyrics_loader.h"
#include "project_manager.h"
#include "downloader_bridge.h"

int main(int argc, char *argv[])
{
    // Forzar renderizado por Software (CPU) en lugar de GPU 3D (OpenGL/DirectX)
    qputenv("QSG_RHI_BACKEND", "software");

    // Redireccionar std::cerr y truncar el log de depuración viejo
    std::ofstream logFile("debug_log.txt", std::ios::trunc);
    std::streambuf *oldCerr = std::cerr.rdbuf(logFile.rdbuf());
    std::cerr << "[LavaLyrics] Booting engine (Software Rendering fallback)..." << std::endl;

#if QT_VERSION < QT_VERSION_CHECK(6, 0, 0)
    QCoreApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
#endif

    QApplication app(argc, argv);
    QQuickStyle::setStyle("Basic");
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

    // Conectar warnings para ver qué está fallando en la carga de QML
    QList<QString> qmlErrors;
    QObject::connect(&engine, &QQmlApplicationEngine::warnings, [&qmlErrors](const QList<QQmlError> &warnings) {
        for (const auto &error : warnings) {
            qmlErrors.append(error.toString());
            std::cerr << "QML Error: " << error.toString().toStdString() << std::endl;
        }
    });

    // Expose app version to QML
    engine.rootContext()->setContextProperty("APP_VERSION", app.applicationVersion());

    // Intentar primero desde el recurso QRC compilado que ahora ya está corregido
    QUrl url(QStringLiteral("qrc:/main.qml"));
    
    // Si no está el QRC, buscar físicamente respecto a la ruta del ejecutable (CWD independiente)
    if (!QFile::exists(":/main.qml")) {
        QString appDir = QCoreApplication::applicationDirPath();
        if (QFile::exists(appDir + "/qml/main.qml")) {
            url = QUrl::fromLocalFile(appDir + "/qml/main.qml");
        } else if (QFile::exists(appDir + "/../src/qml/main.qml")) {
            url = QUrl::fromLocalFile(appDir + "/../src/qml/main.qml");
        } else if (QFile::exists("src/qml/main.qml")) {
            url = QUrl::fromLocalFile("src/qml/main.qml");
        }
    }

    QObject::connect(&engine, &QQmlApplicationEngine::objectCreated,
                     &app, [url, &qmlErrors](QObject *obj, const QUrl &objUrl) {
        if (url.toString() == objUrl.toString() || objUrl.path().endsWith("main.qml")) {
            if (!obj) {
                std::string errorMsg = "Error crítico: El objeto raíz QML no pudo ser creado.\n\nDetalles del error:\n";
                if (qmlErrors.isEmpty()) {
                    errorMsg += "Error desconocido de renderizado o inicialización (falta de backend gráfico).";
                } else {
                    for (const auto &err : qmlErrors) {
                        errorMsg += "- " + err.toStdString() + "\n";
                    }
                }
                MessageBoxA(NULL, errorMsg.c_str(), "LavaLyrics C++ — Error de inicio", MB_ICONERROR | MB_OK);
                QCoreApplication::exit(-1);
            } else {
                std::cout << "[LavaLyrics] Success: QML root object created." << std::endl;
            }
        }
    }, Qt::QueuedConnection);

    engine.load(url);

    // Diagnóstico Síncrono Inmediato de QML
    if (engine.rootObjects().isEmpty()) {
        std::string errorMsg = "Error crítico de inicio QML: No se pudo instanciar el objeto raíz.\n\n";
        if (qmlErrors.isEmpty()) {
            errorMsg += "Causa probable: Error en la carga del motor gráfico (OpenGL/RHI), falta de plugins de Qt6 (QtQuick/QtMultimedia), o dependencias DLL del sistema corruptas.\n";
        } else {
            errorMsg += "Detalles capturados:\n";
            for (const auto &err : qmlErrors) {
                errorMsg += "- " + err.toStdString() + "\n";
            }
        }
        std::cerr << "[LavaLyrics] " << errorMsg << std::endl;
        MessageBoxA(NULL, errorMsg.c_str(), "LavaLyrics C++ — Fallo de Inicialización", MB_ICONERROR | MB_OK);
        return -1;
    }

    std::cout << "[LavaLyrics C++] Engine loaded. Starting main loop...\n";
    return app.exec();
}
