#include "project_manager.h"
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QFileInfo>
#include <QSettings>
#include <QDateTime>
#include <QDebug>

ProjectManager::ProjectManager(QObject *parent)
    : QObject(parent), m_isDirty(false)
{
}

QString ProjectManager::projectPath() const { return m_projectPath; }
QString ProjectManager::projectName() const { return m_projectName; }
bool ProjectManager::isDirty() const { return m_isDirty; }

bool ProjectManager::newProject(const QString &name)
{
    m_projectName = name.isEmpty() ? "Nuevo Proyecto" : name;
    m_projectPath.clear();
    m_data.clear();

    // Initialize with defaults
    m_data["name"]      = m_projectName;
    m_data["version"]   = "1.0";
    m_data["created"]   = QDateTime::currentDateTime().toString(Qt::ISODate);
    m_data["audioPath"] = "";
    m_data["lyricsPath"]= "";
    m_data["tracks"]    = QVariantMap();
    m_data["exportSettings"] = QVariantMap{
        {"resolution", "1080x1920"},
        {"fps", 30},
        {"bitrate", "6000k"},
        {"format", "mp4"}
    };

    m_isDirty = false;
    emit projectPathChanged();
    emit isDirtyChanged();
    return true;
}

bool ProjectManager::saveProject(const QString &path)
{
    QString savePath = path.isEmpty() ? m_projectPath : path;
    if (savePath.isEmpty()) {
        emit errorOccurred("No se especificó una ruta de guardado");
        return false;
    }

    // Ensure .llproj extension
    if (!savePath.endsWith(".llproj"))
        savePath += ".llproj";

    m_data["savedAt"] = QDateTime::currentDateTime().toString(Qt::ISODate);
    m_data["name"]    = m_projectName;

    QJsonDocument doc(QJsonObject::fromVariantMap(m_data));
    QFile file(savePath);
    if (!file.open(QIODevice::WriteOnly)) {
        emit errorOccurred("No se pudo guardar en: " + savePath);
        return false;
    }

    file.write(doc.toJson(QJsonDocument::Indented));
    file.close();

    m_projectPath = savePath;
    m_isDirty = false;
    saveRecentProject(savePath);

    emit projectPathChanged();
    emit isDirtyChanged();
    qDebug() << "[ProjectManager] Project saved to:" << savePath;
    return true;
}

bool ProjectManager::loadProject(const QString &path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        emit errorOccurred("No se pudo abrir: " + path);
        return false;
    }

    QByteArray data = file.readAll();
    file.close();

    QJsonDocument doc = QJsonDocument::fromJson(data);
    if (doc.isNull() || !doc.isObject()) {
        emit errorOccurred("Archivo de proyecto inválido: " + path);
        return false;
    }

    m_data = doc.object().toVariantMap();
    m_projectPath = path;
    m_projectName = m_data.value("name", QFileInfo(path).baseName()).toString();
    m_isDirty = false;

    saveRecentProject(path);
    emit projectPathChanged();
    emit isDirtyChanged();
    emit projectLoaded(m_data);

    qDebug() << "[ProjectManager] Project loaded:" << m_projectName;
    return true;
}

QVariantMap ProjectManager::getProjectData() const { return m_data; }

void ProjectManager::setProjectData(const QVariantMap &data)
{
    m_data = data;
    markDirty();
}

void ProjectManager::markDirty()
{
    if (!m_isDirty) {
        m_isDirty = true;
        emit isDirtyChanged();
    }
}

QStringList ProjectManager::recentProjects() const
{
    QSettings settings("LavaLyrics", "LavaLyrics");
    return settings.value("recentProjects").toStringList();
}

void ProjectManager::saveRecentProject(const QString &path)
{
    QSettings settings("LavaLyrics", "LavaLyrics");
    QStringList recent = settings.value("recentProjects").toStringList();
    recent.removeAll(path);
    recent.prepend(path);
    while (recent.size() > 10) recent.removeLast();
    settings.setValue("recentProjects", recent);
}
