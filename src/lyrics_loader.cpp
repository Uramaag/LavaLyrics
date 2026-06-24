#include "lyrics_loader.h"
#include <QFile>
#include <QTextStream>
#include <QJsonDocument>
#include <QJsonArray>
#include <QJsonObject>
#include <QRegularExpression>
#include <QDebug>
#include <algorithm>

LyricsLoader::LyricsLoader(QObject *parent)
    : QObject(parent), m_currentIndex(-1)
{
}

QString LyricsLoader::lyricsPath() const { return m_lyricsPath; }

void LyricsLoader::setLyricsPath(const QString &path)
{
    if (m_lyricsPath != path) {
        m_lyricsPath = path;
        emit lyricsPathChanged();
    }
}

QString LyricsLoader::currentLine() const
{
    if (m_currentIndex >= 0 && m_currentIndex < m_lines.size())
        return m_lines[m_currentIndex].text;
    return QString();
}

QString LyricsLoader::prevLine() const
{
    if (m_currentIndex > 0)
        return m_lines[m_currentIndex - 1].text;
    return QString();
}

QString LyricsLoader::nextLine() const
{
    if (m_currentIndex >= 0 && m_currentIndex + 1 < m_lines.size())
        return m_lines[m_currentIndex + 1].text;
    return QString();
}

int LyricsLoader::currentIndex() const { return m_currentIndex; }
bool LyricsLoader::isLoaded() const { return !m_lines.isEmpty(); }

bool LyricsLoader::loadLrc(const QString &path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        qWarning() << "[LyricsLoader] Cannot open LRC file:" << path;
        return false;
    }

    QTextStream in(&file);
    in.setEncoding(QStringConverter::Utf8);
    QString content = in.readAll();
    file.close();

    m_lines.clear();
    m_currentIndex = -1;
    parseLrcContent(content);

    m_lyricsPath = path;
    emit lyricsPathChanged();
    qDebug() << "[LyricsLoader] Loaded" << m_lines.size() << "lines from LRC";
    return !m_lines.isEmpty();
}

bool LyricsLoader::loadJson(const QString &path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        qWarning() << "[LyricsLoader] Cannot open JSON lyrics file:" << path;
        return false;
    }

    QByteArray data = file.readAll();
    file.close();

    QJsonDocument doc = QJsonDocument::fromJson(data);
    if (doc.isNull()) {
        qWarning() << "[LyricsLoader] Invalid JSON in:" << path;
        return false;
    }

    m_lines.clear();
    m_currentIndex = -1;

    // Support lrclib.net format: array of {startTimeMs, words}
    QJsonArray arr = doc.array();
    for (const QJsonValue &val : arr) {
        QJsonObject obj = val.toObject();
        LyricLine line;
        line.timeMs = obj["startTimeMs"].toDouble();
        line.text   = obj["words"].toString().trimmed();
        if (!line.text.isEmpty())
            m_lines.append(line);
    }

    // Sort by time just in case
    std::sort(m_lines.begin(), m_lines.end(), [](const LyricLine &a, const LyricLine &b) {
        return a.timeMs < b.timeMs;
    });

    m_lyricsPath = path;
    emit lyricsPathChanged();
    qDebug() << "[LyricsLoader] Loaded" << m_lines.size() << "lines from JSON";
    return !m_lines.isEmpty();
}

QVariantList LyricsLoader::getAllLines() const
{
    QVariantList list;
    for (const auto &line : m_lines) {
        QVariantMap map;
        map["timeMs"] = line.timeMs;
        map["text"]   = line.text;
        list.append(map);
    }
    return list;
}

void LyricsLoader::updateTime(double masterTimeSeconds)
{
    if (m_lines.isEmpty()) return;

    double ms = masterTimeSeconds * 1000.0;
    int newIdx = -1;

    // Binary search for the last line whose timestamp <= current time
    int lo = 0, hi = m_lines.size() - 1;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;
        if (m_lines[mid].timeMs <= ms) {
            newIdx = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    if (newIdx != m_currentIndex) {
        m_currentIndex = newIdx;
        emit currentLineChanged();
    }
}

void LyricsLoader::clear()
{
    m_lines.clear();
    m_currentIndex = -1;
    emit currentLineChanged();
}

void LyricsLoader::parseLrcContent(const QString &content)
{
    // LRC format: [mm:ss.xx] lyric text
    static QRegularExpression re(R"(\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*))");

    const QStringList lines = content.split('\n');
    for (const QString &rawLine : lines) {
        QRegularExpressionMatch match = re.match(rawLine.trimmed());
        if (match.hasMatch()) {
            int minutes = match.captured(1).toInt();
            int seconds = match.captured(2).toInt();
            int centis  = match.captured(3).toInt();
            // Handle both 2-digit (centiseconds) and 3-digit (milliseconds)
            double ms = (minutes * 60000.0) + (seconds * 1000.0) +
                        (match.captured(3).length() == 3 ? centis : centis * 10.0);

            QString text = match.captured(4).trimmed();
            if (!text.isEmpty()) {
                m_lines.append({ms, text});
            }
        }
    }

    std::sort(m_lines.begin(), m_lines.end(), [](const LyricLine &a, const LyricLine &b) {
        return a.timeMs < b.timeMs;
    });
}
