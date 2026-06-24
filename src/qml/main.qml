import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import LavaLyrics 1.0

ApplicationWindow {
    id: window
    visible: true
    width: 1280
    height: 768
    title: "LavaLyrics C++ — Creador de Videos Musicales Virales"

    TimelineController {
        id: timeline
    }

    MediaPlayerEngine {
        id: mediaEngine
    }

    VideoExporter {
        id: exporter
    }

    // Custom design system palette (matching React theme)
    readonly property color bgDeep: "#0a0a0a"
    readonly property color bgDark: "#121212"
    readonly property color bgElevated: "#1e1e1e"
    readonly property color borderSubtle: "#2d2d2d"
    readonly property color lavaRed: "#ff3e3e"
    readonly property color textPrimary: "#ffffff"
    readonly property color textSecondary: "#b3b3b3"
    readonly property color textMuted: "#666666"

    background: Rectangle {
        color: window.bgDeep
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // 1. Top Header Bar
        Rectangle {
            Layout.fillWidth: true
            height: 56
            color: window.bgDark
            border.color: window.borderSubtle
            border.width: 1

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 16
                anchors.rightMargin: 16

                // Logo
                Row {
                    spacing: 4
                    Text {
                        text: "Lava"
                        font.family: "Outfit"
                        font.pixelSize: 18
                        font.bold: true
                        color: window.textPrimary
                    }
                    Text {
                        text: "Lyrics"
                        font.family: "Outfit"
                        font.pixelSize: 18
                        font.bold: true
                        color: window.lavaRed
                    }
                }

                // Project Info
                Column {
                    Layout.leftMargin: 20
                    Text {
                        text: "VideoTiktok (C++)"
                        font.pixelSize: 13
                        font.bold: true
                        color: window.textPrimary
                    }
                    Text {
                        text: "Enjambre — Último Tema"
                        font.pixelSize: 10
                        color: window.textSecondary
                    }
                }

                Item { Layout.fillWidth: true }

                // Action Buttons
                Button {
                    text: "← Volver al inicio"
                    contentItem: Text {
                        text: parent.text
                        color: window.textPrimary
                        font.bold: true
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                    background: Rectangle {
                        color: parent.hovered ? "#2d2d2d" : "transparent"
                        border.color: window.borderSubtle
                        border.width: 1
                        radius: 4
                    }
                }

                Button {
                    id: btnExport
                    text: "Exportar →"
                    contentItem: Text {
                        text: parent.text
                        color: "#ffffff"
                        font.bold: true
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                    background: Rectangle {
                        color: parent.hovered ? "#ff5252" : window.lavaRed
                        radius: 4
                    }
                }
            }
        }

        // 2. Middle Work Area (Sidebar, Viewport, Controls)
        SplitView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            orientation: Qt.Horizontal

            // Sidebar Panel (Left)
            Rectangle {
                SplitView.preferredWidth: 320
                color: window.bgDark
                border.color: window.borderSubtle
                border.width: 1

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 16

                    Text {
                        text: "Biblioteca multimedia"
                        font.pixelSize: 14
                        font.bold: true
                        color: window.textPrimary
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        height: 80
                        color: "#181818"
                        border.color: window.borderSubtle
                        radius: 6

                        ColumnLayout {
                            anchors.centerIn: parent
                            spacing: 4
                            Text {
                                text: "🎵 Audio principal"
                                font.bold: true
                                color: window.textPrimary
                                anchors.horizontalCenter: parent.horizontalCenter
                            }
                            Text {
                                text: "Enjambre_Ultimo_Tema.mp3"
                                font.pixelSize: 11
                                color: window.textMuted
                                anchors.horizontalCenter: parent.horizontalCenter
                            }
                        }
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        color: "#181818"
                        border.color: window.borderSubtle
                        radius: 6

                        Text {
                            anchors.centerIn: parent
                            text: "Arrastra tus videos de fondo aquí"
                            font.pixelSize: 12
                            color: window.textMuted
                        }
                    }
                }
            }

            // Central Viewport Area (9:16 Video Player Preview)
            Rectangle {
                SplitView.fillWidth: true
                color: window.bgDeep

                Item {
                    anchors.centerIn: parent
                    width: parent.height * (9/16)
                    height: parent.height - 32

                    // Black smartphone container
                    Rectangle {
                        anchors.fill: parent
                        color: "#000000"
                        border.color: window.borderSubtle
                        border.width: 1
                        radius: 12
                        clip: true

                        // Video frame preview canvas placeholder
                        Rectangle {
                            anchors.fill: parent
                            color: "#111"
                            opacity: 0.8

                            Text {
                                anchors.centerIn: parent
                                text: "🎬 Video Viewport [FFmpeg]"
                                font.bold: true
                                color: window.textMuted
                            }
                        }

                        // Safe margin dashed grid overlay
                        Rectangle {
                            anchors.fill: parent
                            anchors.topMargin: parent.height * 0.1
                            anchors.bottomMargin: parent.height * 0.15
                            anchors.leftMargin: parent.width * 0.1
                            anchors.rightMargin: parent.width * 0.1
                            color: "transparent"
                            border.color: "red"
                            border.width: 1
                            opacity: 0.3
                        }

                        // Subtitle overlay
                        Column {
                            anchors.centerIn: parent
                            width: parent.width * 0.8
                            spacing: 12

                            Text {
                                text: "Soy culpable del pecado"
                                font.family: "Montserrat"
                                font.pixelSize: 14
                                font.bold: true
                                color: window.textSecondary
                                horizontalAlignment: Text.AlignHCenter
                                width: parent.width
                                opacity: 0.6
                            }

                            Text {
                                text: "De no haberme percatado"
                                font.family: "Montserrat"
                                font.pixelSize: 22
                                font.bold: true
                                color: "#ffffff"
                                horizontalAlignment: Text.AlignHCenter
                                width: parent.width
                                style: Text.Outline
                                styleColor: "#000000"
                            }

                            Text {
                                text: "Que lo nuestro había acabado"
                                font.family: "Montserrat"
                                font.pixelSize: 14
                                font.bold: true
                                color: window.textSecondary
                                horizontalAlignment: Text.AlignHCenter
                                width: parent.width
                                opacity: 0.6
                            }
                        }
                    }
                }
            }
        }

        // 3. Bottom Timeline Panel
        Rectangle {
            Layout.fillWidth: true
            height: 240
            color: window.bgDark
            border.color: window.borderSubtle
            border.width: 1

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                // Timeline transport controls
                Rectangle {
                    Layout.fillWidth: true
                    height: 42
                    color: "#161616"
                    border.color: window.borderSubtle
                    border.width: 1

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 16
                        anchors.rightMargin: 16

                        Row {
                            spacing: 8
                            Button { text: "⏮"; background: Rectangle { color: "transparent" } }
                            Button { text: "⏪"; background: Rectangle { color: "transparent" } }
                            Button { text: "▶"; font.bold: true; background: Rectangle { color: "transparent" } }
                            Button { text: "⏩"; background: Rectangle { color: "transparent" } }
                            Button { text: "⏭"; background: Rectangle { color: "transparent" } }
                        }

                        Text {
                            text: "00:19:52 / 03:48:00"
                            font.pixelSize: 11
                            color: window.textSecondary
                        }

                        Item { Layout.fillWidth: true }
                    }
                }

                // Interactive Timeline tracks view
                ScrollView {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true

                    ColumnLayout {
                        width: 2000 // simulate long horizontal zoom width
                        spacing: 4
                        anchors.margins: 10

                        // Track 1: Video
                        RowLayout {
                            height: 36
                            Rectangle {
                                width: 100
                                height: 36
                                color: "#1e1e1e"
                                Text { text: "🎬 Video Track"; anchors.centerIn: parent; color: window.textSecondary; font.pixelSize: 11 }
                            }
                            Rectangle {
                                Layout.fillWidth: true
                                height: 36
                                color: "#152535"
                                border.color: "#355575"
                                radius: 4
                                Text { text: "78850eba_IMG_4652.mov (15.7s)"; anchors.centerIn: parent; color: "#79aada"; font.pixelSize: 11 }
                            }
                        }

                        // Track 2: Audio & Lyrics (Synchronized link)
                        RowLayout {
                            height: 52
                            Rectangle {
                                width: 100
                                height: 52
                                color: "#1e1e1e"
                                Text { text: "🎵 Audio / Lyrics"; anchors.centerIn: parent; color: window.textSecondary; font.pixelSize: 11 }
                            }
                            Rectangle {
                                Layout.fillWidth: true
                                height: 52
                                color: "#251515"
                                border.color: "#753535"
                                radius: 4

                                Column {
                                    anchors.centerIn: parent
                                    spacing: 2
                                    Text { text: "🎵 Último Tema.mp3 (Recortado a 220s)"; color: "#da7979"; font.pixelSize: 11 }
                                    Text { text: "📝 Letras Sincronizadas activas"; color: "#a5a5a5"; font.pixelSize: 10 }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
