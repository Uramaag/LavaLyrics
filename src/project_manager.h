#ifndef PROJECT_MANAGER_H
#define PROJECT_MANAGER_H

#include <QObject>
#include <QString>
#include <QVariantMap>
#include <QVariantList>

class ProjectManager : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString projectPath READ projectPath NOTIFY projectPathChanged)
    Q_PROPERTY(QString projectName READ projectName NOTIFY projectPathChanged)
    Q_PROPERTY(bool isDirty READ isDirty NOTIFY isDirtyChanged)

public:
    explicit ProjectManager(QObject *parent = nullptr);

    QString projectPath() const;
    QString projectName() const;
    bool isDirty() const;

    Q_INVOKABLE bool newProject(const QString &name);
    Q_INVOKABLE bool saveProject(const QString &path = QString());
    Q_INVOKABLE bool loadProject(const QString &path);
    Q_INVOKABLE QVariantMap getProjectData() const;
    Q_INVOKABLE void setProjectData(const QVariantMap &data);
    Q_INVOKABLE void markDirty();
    Q_INVOKABLE QStringList recentProjects() const;

signals:
    void projectPathChanged();
    void isDirtyChanged();
    void projectLoaded(const QVariantMap &data);
    void errorOccurred(const QString &message);

private:
    QString m_projectPath;
    QString m_projectName;
    bool m_isDirty;
    QVariantMap m_data;

    void saveRecentProject(const QString &path);
};

#endif // PROJECT_MANAGER_H
