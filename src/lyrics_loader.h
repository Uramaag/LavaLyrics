#ifndef LYRICS_LOADER_H
#define LYRICS_LOADER_H

#include <QObject>
#include <QString>
#include <QList>
#include <QVariantList>
#include <QVariantMap>

struct LyricLine {
    double timeMs;   // timestamp in milliseconds
    QString text;
};

class LyricsLoader : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString lyricsPath READ lyricsPath WRITE setLyricsPath NOTIFY lyricsPathChanged)
    Q_PROPERTY(QString currentLine READ currentLine NOTIFY currentLineChanged)
    Q_PROPERTY(QString prevLine READ prevLine NOTIFY currentLineChanged)
    Q_PROPERTY(QString nextLine READ nextLine NOTIFY currentLineChanged)
    Q_PROPERTY(int currentIndex READ currentIndex NOTIFY currentLineChanged)
    Q_PROPERTY(bool isLoaded READ isLoaded NOTIFY lyricsPathChanged)

public:
    explicit LyricsLoader(QObject *parent = nullptr);

    QString lyricsPath() const;
    void setLyricsPath(const QString &path);

    QString currentLine() const;
    QString prevLine() const;
    QString nextLine() const;
    int currentIndex() const;
    bool isLoaded() const;

    Q_INVOKABLE bool loadLrc(const QString &path);
    Q_INVOKABLE bool loadJson(const QString &path);
    Q_INVOKABLE QVariantList getAllLines() const;
    Q_INVOKABLE void updateTime(double masterTimeSeconds);
    Q_INVOKABLE void clear();

signals:
    void lyricsPathChanged();
    void currentLineChanged();

private:
    QString m_lyricsPath;
    QList<LyricLine> m_lines;
    int m_currentIndex;

    void parseLrcContent(const QString &content);
};

#endif // LYRICS_LOADER_H
