import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import LavaLyrics 1.0

ApplicationWindow {
    id: window
    visible: true
    width: 1400
    height: 860
    minimumWidth: 1100
    minimumHeight: 700
    title: projectMgr.isDirty
           ? "● LavaLyrics C++ — " + projectMgr.projectName
           : "LavaLyrics C++ — " + projectMgr.projectName

    // ── C++ Backend objects ────────────────────────────────────────────────
    TimelineController { id: timeline }
    MediaPlayerEngine  { id: mediaEngine }
    VideoExporter      { id: exporter }
    LyricsLoader       { id: lyricsLoader }
    ProjectManager     { id: projectMgr }
    DownloaderBridge   { id: downloader }

    // ── Design tokens ──────────────────────────────────────────────────────
    readonly property color bgDeep:       "#080810"
    readonly property color bgDark:       "#10101a"
    readonly property color bgElevated:   "#18182a"
    readonly property color bgCard:       "#1e1e30"
    readonly property color borderSubtle: "#2a2a40"
    readonly property color lavaRed:      "#ff3e3e"
    readonly property color lavaOrange:   "#ff6b35"
    readonly property color lavaPurple:   "#9d4edd"
    readonly property color textPrimary:  "#ffffff"
    readonly property color textSecondary:"#b0b0cc"
    readonly property color textMuted:    "#606080"
    readonly property color accentGlow:   "#ff3e3e44"

    // ── App state ──────────────────────────────────────────────────────────
    property int    currentScreen: 0   // 0=home, 1=download, 2=editor
    property double zoomLevel:     1.0
    property double timelineScale: 80  // px per second

    background: Rectangle { color: window.bgDeep }

    // Connections from C++ signals
    Connections {
        target: mediaEngine
        function onPositionChanged() {
            lyricsLoader.updateTime(mediaEngine.position)
        }
        function onMediaLoaded(success, path) {
            if (success) statusBar.showMsg("Media cargado: " + path.split('/').pop())
        }
    }

    Connections {
        target: downloader
        function onDownloadCompleted(audioPath, lyricsPath) {
            statusBar.showMsg("✅ Descarga completada")
            if (audioPath !== "") mediaEngine.loadMedia(audioPath)
            if (lyricsPath !== "") {
                if (lyricsPath.endsWith(".lrc"))  lyricsLoader.loadLrc(lyricsPath)
                if (lyricsPath.endsWith(".json")) lyricsLoader.loadJson(lyricsPath)
            }
            currentScreen = 2
        }
        function onDownloadFailed(error) {
            statusBar.showMsg("❌ Error: " + error)
        }
    }

    Connections {
        target: exporter
        function onExportCompleted(path) {
            exportDialog.visible = false
            statusBar.showMsg("🎬 Exportado: " + path.split('\\').pop())
        }
        function onExportFailed(error) {
            statusBar.showMsg("❌ Exportación fallida: " + error)
        }
    }

    // ── File dialogs ───────────────────────────────────────────────────────
    FileDialog {
        id: openMediaDialog
        title: "Abrir archivo de audio/video"
        nameFilters: ["Archivos de audio/video (*.mp3 *.m4a *.flac *.wav *.mp4 *.mov *.mkv)", "Todos (*)"]
        onAccepted: {
            mediaEngine.loadMedia(selectedFile.toString().replace("file:///", ""))
        }
    }

    FileDialog {
        id: openLyricsDialog
        title: "Abrir archivo de letras"
        nameFilters: ["LRC Lyrics (*.lrc)", "JSON Lyrics (*.json)", "Todos (*.*)"]
        onAccepted: {
            let p = selectedFile.toString().replace("file:///", "")
            if (p.endsWith(".lrc"))  lyricsLoader.loadLrc(p)
            else                     lyricsLoader.loadJson(p)
        }
    }

    FileDialog {
        id: saveProjectDialog
        title: "Guardar proyecto"
        fileMode: FileDialog.SaveFile
        nameFilters: ["LavaLyrics Project (*.llproj)"]
        onAccepted: {
            projectMgr.saveProject(selectedFile.toString().replace("file:///", ""))
        }
    }

    FileDialog {
        id: exportFileDialog
        title: "Exportar video"
        fileMode: FileDialog.SaveFile
        nameFilters: ["MP4 Video (*.mp4)"]
        onAccepted: {
            let path = selectedFile.toString().replace("file:///", "")
            exporter.startExport(path,
                {"resolution": "1080x1920", "fps": 30, "bitrate": "6000k", "format": "mp4"},
                {
                    "audioPath":  mediaEngine.mediaPath,
                    "lyricsData": lyricsLoader.getAllLines(),
                    "videoClips": timeline.getClips("video")
                }
            )
            exportDialog.visible = true
        }
    }

    // ── Export progress dialog ─────────────────────────────────────────────
    Window {
        id: exportDialog
        visible: false
        width: 440; height: 260
        title: "Exportando video..."
        flags: Qt.Dialog | Qt.WindowTitleHint
        color: window.bgDark
        modality: Qt.ApplicationModal

        ColumnLayout {
            anchors.centerIn: parent
            width: parent.width - 48
            spacing: 20

            Text {
                text: "🎬 Exportando video musical"
                font.pixelSize: 18; font.bold: true
                color: window.textPrimary
                Layout.alignment: Qt.AlignHCenter
            }
            Text {
                text: exporter.statusMsg
                font.pixelSize: 13; color: window.textSecondary
                Layout.alignment: Qt.AlignHCenter
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
            }
            Rectangle {
                Layout.fillWidth: true; height: 8
                color: window.bgElevated; radius: 4
                Rectangle {
                    width: parent.width * exporter.progress / 100
                    height: parent.height; radius: 4
                    gradient: Gradient {
                        orientation: Gradient.Horizontal
                        GradientStop { position: 0; color: window.lavaRed }
                        GradientStop { position: 1; color: window.lavaOrange }
                    }
                    Behavior on width { NumberAnimation { duration: 300 } }
                }
            }
            Text {
                text: Math.round(exporter.progress) + "%"
                font.pixelSize: 24; font.bold: true; color: window.lavaRed
                Layout.alignment: Qt.AlignHCenter
            }
            Button {
                text: "Cancelar"
                Layout.alignment: Qt.AlignHCenter
                onClicked: { exporter.cancelExport(); exportDialog.visible = false }
                contentItem: Text { text: parent.text; color: window.textSecondary; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                background: Rectangle { color: parent.hovered ? window.bgElevated : "transparent"; border.color: window.borderSubtle; border.width: 1; radius: 6 }
            }
        }
    }

    // ── Create New Project Dialog Modal ──────────────────────────────────────
    Window {
        id: createProjectDialog
        visible: false
        width: 500; height: 350
        title: "Crear Nuevo Proyecto"
        flags: Qt.Dialog | Qt.WindowTitleHint | Qt.CustomizeWindowHint
        color: window.bgDark
        modality: Qt.ApplicationModal

        ColumnLayout {
            anchors.fill: parent; anchors.margins: 24
            spacing: 16

            Text {
                text: "✨ Crear Nuevo Proyecto"
                font.pixelSize: 20; font.bold: true; color: window.textPrimary
            }

            Text {
                text: "Configura las opciones iniciales para tu video musical."
                font.pixelSize: 12; color: window.textSecondary
            }

            // Input: Project Name
            ColumnLayout {
                Layout.fillWidth: true; spacing: 4
                Text { text: "Nombre del Proyecto"; font.pixelSize: 11; font.bold: true; color: window.textSecondary }
                Rectangle {
                    Layout.fillWidth: true; height: 40
                    color: window.bgCard; border.color: nameField.activeFocus ? window.lavaRed : window.borderSubtle
                    border.width: nameField.activeFocus ? 2 : 1; radius: 6
                    TextField {
                        id: nameField
                        anchors.fill: parent; anchors.leftMargin: 8; anchors.rightMargin: 8
                        placeholderText: "Mi Video Viral"
                        color: window.textPrimary; background: Item {}
                        font.pixelSize: 13; placeholderTextColor: window.textMuted
                    }
                }
            }

            // Input: Output Directory
            ColumnLayout {
                Layout.fillWidth: true; spacing: 4
                Text { text: "Carpeta de Trabajo"; font.pixelSize: 11; font.bold: true; color: window.textSecondary }
                Rectangle {
                    Layout.fillWidth: true; height: 40
                    color: window.bgCard; border.color: window.borderSubtle; border.width: 1; radius: 6
                    RowLayout {
                        anchors.fill: parent; anchors.margins: 4
                        TextField {
                            id: workspaceDirField
                            Layout.fillWidth: true
                            text: "C:/Users/" + Qt.platform.os + "/Music/LavaLyrics"
                            color: window.textSecondary; background: Item {}
                            font.pixelSize: 12; placeholderTextColor: window.textMuted
                        }
                    }
                }
            }

            Item { Layout.fillHeight: true }

            // Dialog Actions
            RowLayout {
                Layout.fillWidth: true; spacing: 12
                
                Button {
                    text: "Cancelar"
                    Layout.fillWidth: true; implicitHeight: 40
                    onClicked: createProjectDialog.close()
                    contentItem: Text { text: parent.text; color: window.textSecondary; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                    background: Rectangle { color: parent.hovered ? window.bgElevated : "transparent"; border.color: window.borderSubtle; border.width: 1; radius: 6 }
                }

                Button {
                    text: "Crear Proyecto 🚀"
                    Layout.fillWidth: true; implicitHeight: 40
                    enabled: nameField.text.trim() !== ""
                    onClicked: {
                        projectMgr.newProject(nameField.text.trim())
                        outDirField.text = workspaceDirField.text.trim()
                        createProjectDialog.close()
                        currentScreen = 1 // Go to Download screen
                    }
                    contentItem: Text { text: parent.text; color: "#fff"; font.bold: true; font.pixelSize: 13; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                    background: Rectangle {
                        color: parent.enabled ? (parent.hovered ? "#ff5252" : window.lavaRed) : window.bgCard
                        radius: 6
                    }
                }
            }
        }

        function open() {
            nameField.text = ""
            visible = true
        }

        function close() {
            visible = false
        }
    }

    // ── Root layout ────────────────────────────────────────────────────────
    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // ── Top Header ────────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: 52
            color: window.bgDark
            border.color: window.borderSubtle; border.width: 1

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 16; anchors.rightMargin: 16
                spacing: 12

                // Logo
                Row {
                    spacing: 0
                    Text { text: "Lava"; font.pixelSize: 20; font.bold: true; color: window.textPrimary; font.family: "Segoe UI" }
                    Text { text: "Lyrics"; font.pixelSize: 20; font.bold: true; color: window.lavaRed; font.family: "Segoe UI" }
                }

                // Screen tabs
                Row {
                    spacing: 2
                    Layout.leftMargin: 12
                    Repeater {
                        model: ["🏠 Inicio", "⬇️ Descargar", "🎬 Editor"]
                        Button {
                            text: modelData
                            onClicked: currentScreen = index
                            contentItem: Text {
                                text: parent.text; color: currentScreen === index ? window.lavaRed : window.textSecondary
                                font.pixelSize: 12; font.bold: currentScreen === index
                                horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter
                            }
                            background: Rectangle {
                                color: currentScreen === index ? window.bgElevated : "transparent"
                                border.color: currentScreen === index ? window.lavaRed : "transparent"
                                border.width: 1; radius: 6
                                Behavior on color { ColorAnimation { duration: 150 } }
                            }
                            implicitWidth: 110; implicitHeight: 34
                        }
                    }
                }

                Item { Layout.fillWidth: true }

                // Project name
                Text {
                    text: projectMgr.projectName
                    color: window.textMuted; font.pixelSize: 11
                    visible: currentScreen === 2
                }

                // Action buttons
                Button {
                    text: "💾 Guardar"
                    visible: currentScreen === 2
                    onClicked: projectMgr.isDirty ? saveProjectDialog.open() : {}
                    contentItem: Text { text: parent.text; color: window.textSecondary; font.pixelSize: 11; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                    background: Rectangle { color: parent.hovered ? window.bgElevated : "transparent"; border.color: window.borderSubtle; border.width: 1; radius: 6 }
                    implicitWidth: 90; implicitHeight: 32
                }

                Button {
                    id: btnExport
                    text: "Exportar ▶"
                    visible: currentScreen === 2
                    enabled: !exporter.isRunning
                    onClicked: exportFileDialog.open()
                    contentItem: Text { text: parent.text; color: "#fff"; font.bold: true; font.pixelSize: 12; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                    background: Rectangle {
                        color: parent.enabled ? (parent.hovered ? "#ff5252" : window.lavaRed) : window.bgCard
                        radius: 6
                        Behavior on color { ColorAnimation { duration: 150 } }
                    }
                    implicitWidth: 110; implicitHeight: 34
                }
            }
        }

        // ── Screen container ───────────────────────────────────────────────
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

            // ── HOME SCREEN ───────────────────────────────────────────────
            Item {
                anchors.fill: parent
                visible: currentScreen === 0

                ColumnLayout {
                    anchors.centerIn: parent
                    spacing: 32

                    // Header
                    Column {
                        spacing: 8
                        Layout.alignment: Qt.AlignHCenter
                        Row {
                            anchors.horizontalCenter: parent.horizontalCenter
                            Text { text: "Lava"; font.pixelSize: 48; font.bold: true; color: window.textPrimary }
                            Text { text: "Lyrics"; font.pixelSize: 48; font.bold: true; color: window.lavaRed }
                        }
                        Text {
                            text: "Crea clips musicales virales con letras sincronizadas"
                            font.pixelSize: 14; color: window.textSecondary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                        Text {
                            text: "v" + APP_VERSION + " — Powered by Qt6 + C++"
                            font.pixelSize: 11; color: window.textMuted
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                    }

                    // Main Action Area (Nuevo Proyecto Card)
                    Rectangle {
                        width: 280; height: 160
                        color: window.bgCard
                        border.color: newProjectMouse.containsMouse ? window.lavaRed : window.borderSubtle
                        border.width: 1; radius: 12
                        Layout.alignment: Qt.AlignHCenter
                        
                        // Glow effect
                        Rectangle {
                            anchors.fill: parent; radius: 12; z: -1
                            color: "transparent"; border.color: window.lavaRed; border.width: 2
                            opacity: newProjectMouse.containsMouse ? 0.3 : 0
                        }

                        Column {
                            anchors.centerIn: parent
                            spacing: 12
                            Text {
                                text: "➕"
                                font.pixelSize: 36
                                anchors.horizontalCenter: parent.horizontalCenter
                            }
                            Text {
                                text: "NUEVO PROYECTO"
                                font.pixelSize: 15
                                font.bold: true
                                color: window.textPrimary
                                anchors.horizontalCenter: parent.horizontalCenter
                            }
                            Text {
                                text: "Comienza una nueva creación"
                                font.pixelSize: 11
                                color: window.textMuted
                                anchors.horizontalCenter: parent.horizontalCenter
                            }
                        }

                        MouseArea {
                            id: newProjectMouse
                            anchors.fill: parent; hoverEnabled: true
                            onClicked: createProjectDialog.open()
                        }
                    }

                    // Table with recent projects
                    ColumnLayout {
                        spacing: 10
                        Layout.alignment: Qt.AlignHCenter
                        Layout.preferredWidth: 600
                        visible: projectMgr.recentProjects().length > 0

                        Text {
                            text: "Proyectos recientes"
                            color: window.textSecondary; font.pixelSize: 14; font.bold: true
                            Layout.alignment: Qt.AlignLeft
                        }

                        // Recent projects table header
                        Rectangle {
                            Layout.fillWidth: true; height: 30
                            color: window.bgDark
                            border.color: window.borderSubtle; border.width: 1
                            radius: 6

                            RowLayout {
                                anchors.fill: parent; anchors.leftMargin: 12; anchors.rightMargin: 12
                                Text { text: "Nombre de Proyecto"; color: window.textMuted; font.pixelSize: 11; Layout.fillWidth: true }
                                Text { text: "Ubicación"; color: window.textMuted; font.pixelSize: 11; Layout.preferredWidth: 250 }
                            }
                        }

                        // Table rows
                        Repeater {
                            model: projectMgr.recentProjects().slice(0, 5)
                            Rectangle {
                                Layout.fillWidth: true; height: 38
                                color: rowMouse.containsMouse ? window.bgElevated : "transparent"
                                border.color: window.borderSubtle; border.width: 1
                                radius: 6

                                RowLayout {
                                    anchors.fill: parent; anchors.leftMargin: 12; anchors.rightMargin: 12
                                    Text {
                                        text: "📁  " + modelData.split("\\").pop().replace(".llproj", "")
                                        color: window.textPrimary; font.pixelSize: 12; font.bold: true
                                        Layout.fillWidth: true
                                    }
                                    Text {
                                        text: modelData
                                        color: window.textMuted; font.pixelSize: 11; elide: Text.ElideLeft
                                        Layout.preferredWidth: 250
                                    }
                                }

                                MouseArea {
                                    id: rowMouse
                                    anchors.fill: parent; hoverEnabled: true
                                    onClicked: projectMgr.loadProject(modelData)
                                }
                            }
                        }
                    }
                }
            }

            // ── DOWNLOAD SCREEN ────────────────────────────────────────────
            Item {
                anchors.fill: parent
                visible: currentScreen === 1

                ColumnLayout {
                    anchors.centerIn: parent
                    width: 560; spacing: 24

                    Text { text: "⬇️ Descargar canción"; font.pixelSize: 28; font.bold: true; color: window.textPrimary; Layout.alignment: Qt.AlignHCenter }
                    Text { text: "Pega una URL de YouTube, YouTube Music o Spotify"; font.pixelSize: 14; color: window.textSecondary; Layout.alignment: Qt.AlignHCenter }

                    // URL input
                    Rectangle {
                        Layout.fillWidth: true; height: 52
                        color: window.bgCard; border.color: urlField.activeFocus ? window.lavaRed : window.borderSubtle
                        border.width: urlField.activeFocus ? 2 : 1; radius: 10
                        Behavior on border.color { ColorAnimation { duration: 150 } }

                        RowLayout {
                            anchors.fill: parent; anchors.margins: 12
                            Text { text: "🔗"; font.pixelSize: 18 }
                            TextField {
                                id: urlField
                                Layout.fillWidth: true
                                placeholderText: "https://open.spotify.com/track/... o https://youtube.com/..."
                                color: window.textPrimary
                                background: Item {}
                                font.pixelSize: 13
                                placeholderTextColor: window.textMuted
                                onAccepted: btnDownload.clicked()
                            }
                        }
                    }

                    // Output dir
                    Rectangle {
                        Layout.fillWidth: true; height: 44
                        color: window.bgCard; border.color: window.borderSubtle; border.width: 1; radius: 10
                        RowLayout {
                            anchors.fill: parent; anchors.margins: 12
                            Text { text: "📂"; font.pixelSize: 16 }
                            TextField {
                                id: outDirField
                                Layout.fillWidth: true
                                color: window.textSecondary
                                background: Item {}
                                font.pixelSize: 12
                                placeholderTextColor: window.textMuted
                                placeholderText: "Carpeta de destino"
                            }
                        }
                    }

                    // Download progress
                    Rectangle {
                        Layout.fillWidth: true; height: 8
                        color: window.bgElevated; radius: 4
                        visible: downloader.isDownloading || downloader.progress > 0
                        Rectangle {
                            width: parent.width * downloader.progress / 100; height: parent.height; radius: 4
                            gradient: Gradient {
                                orientation: Gradient.Horizontal
                                GradientStop { position: 0; color: window.lavaRed }
                                GradientStop { position: 1; color: window.lavaPurple }
                            }
                            Behavior on width { NumberAnimation { duration: 400 } }
                        }
                    }

                    Text {
                        text: downloader.statusMessage
                        color: window.textSecondary; font.pixelSize: 12
                        Layout.alignment: Qt.AlignHCenter
                        visible: text !== ""
                        wrapMode: Text.WordWrap; Layout.fillWidth: true
                        horizontalAlignment: Text.AlignHCenter
                    }

                    // Buttons
                    RowLayout {
                        Layout.alignment: Qt.AlignHCenter; spacing: 12

                        Button {
                            id: btnDownload
                            text: downloader.isDownloading ? "Descargando..." : "⬇️  Descargar"
                            enabled: !downloader.isDownloading && urlField.text.trim() !== ""
                            implicitWidth: 180; implicitHeight: 44
                            onClicked: {
                                let url = urlField.text.trim()
                                let dir = outDirField.text.trim()
                                if (url.indexOf("spotify") >= 0) downloader.downloadSpotify(url, dir)
                                else downloader.downloadFromUrl(url, dir)
                            }
                            contentItem: Text { text: parent.text; color: "#fff"; font.bold: true; font.pixelSize: 14; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                            background: Rectangle {
                                color: parent.enabled ? (parent.hovered ? "#ff5252" : window.lavaRed) : window.bgCard
                                radius: 10
                                Behavior on color { ColorAnimation { duration: 150 } }
                            }
                        }

                        Button {
                            text: "📂 Abrir audio local"
                            implicitWidth: 160; implicitHeight: 44
                            onClicked: openMediaDialog.open()
                            contentItem: Text { text: parent.text; color: window.textSecondary; font.pixelSize: 13; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                            background: Rectangle { color: parent.hovered ? window.bgElevated : window.bgCard; border.color: window.borderSubtle; border.width: 1; radius: 10; Behavior on color { ColorAnimation { duration: 150 } } }
                        }

                        Button {
                            text: "✋ Cancelar"
                            visible: downloader.isDownloading
                            implicitWidth: 100; implicitHeight: 44
                            onClicked: downloader.cancel()
                            contentItem: Text { text: parent.text; color: window.textSecondary; font.pixelSize: 13; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                            background: Rectangle { color: parent.hovered ? window.bgElevated : "transparent"; border.color: window.borderSubtle; border.width: 1; radius: 10 }
                        }
                    }

                    // Manual lyrics load
                    Row {
                        Layout.alignment: Qt.AlignHCenter; spacing: 8
                        Text { text: "o"; color: window.textMuted; font.pixelSize: 12; anchors.verticalCenter: parent.verticalCenter }
                        Button {
                            text: "📝 Cargar letras .lrc manualmente"
                            onClicked: openLyricsDialog.open()
                            contentItem: Text { text: parent.text; color: window.lavaPurple; font.pixelSize: 12; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                            background: Rectangle { color: "transparent" }
                        }
                    }
                }
            }

            // ── EDITOR SCREEN ──────────────────────────────────────────────
            Item {
                anchors.fill: parent
                visible: currentScreen === 2

                SplitView {
                    anchors.fill: parent
                    orientation: Qt.Horizontal

                    // ── Left sidebar ───────────────────────────────────────
                    Rectangle {
                        SplitView.preferredWidth: 280
                        SplitView.minimumWidth:   200
                        color: window.bgDark
                        border.color: window.borderSubtle; border.width: 1

                        ColumnLayout {
                            anchors.fill: parent; anchors.margins: 12; spacing: 12

                            Text { text: "Biblioteca"; font.pixelSize: 13; font.bold: true; color: window.textPrimary }

                            // Audio file card
                            Rectangle {
                                Layout.fillWidth: true; height: 76
                                color: window.bgCard; border.color: window.borderSubtle; border.width: 1; radius: 8
                                Column {
                                    anchors.centerIn: parent; spacing: 4
                                    Text { text: "🎵 Audio"; font.bold: true; color: window.textPrimary; font.pixelSize: 12; anchors.horizontalCenter: parent.horizontalCenter }
                                    Text {
                                        text: mediaEngine.mediaPath !== "" ? mediaEngine.mediaPath.split("/").pop().split("\\").pop() : "Sin audio cargado"
                                        color: window.textMuted; font.pixelSize: 10; anchors.horizontalCenter: parent.horizontalCenter
                                        elide: Text.ElideRight; width: 240
                                    }
                                    Text {
                                        text: mediaEngine.duration > 0 ? "⏱ " + mediaEngine.formatTime(mediaEngine.duration) : ""
                                        color: window.lavaRed; font.pixelSize: 10; anchors.horizontalCenter: parent.horizontalCenter
                                    }
                                }
                                MouseArea { anchors.fill: parent; onClicked: openMediaDialog.open() }
                            }

                            // Lyrics card
                            Rectangle {
                                Layout.fillWidth: true; height: 62
                                color: window.bgCard; border.color: window.borderSubtle; border.width: 1; radius: 8
                                Column {
                                    anchors.centerIn: parent; spacing: 4
                                    Text { text: "📝 Letras"; font.bold: true; color: window.textPrimary; font.pixelSize: 12; anchors.horizontalCenter: parent.horizontalCenter }
                                    Text {
                                        text: lyricsLoader.isLoaded ? "✅ " + lyricsLoader.getAllLines().length + " líneas cargadas" : "Sin letras"
                                        color: lyricsLoader.isLoaded ? "#4caf50" : window.textMuted
                                        font.pixelSize: 10; anchors.horizontalCenter: parent.horizontalCenter
                                    }
                                }
                                MouseArea { anchors.fill: parent; onClicked: openLyricsDialog.open() }
                            }

                            // Lyrics list preview
                            Text { text: "Líneas de letras"; color: window.textMuted; font.pixelSize: 11 }
                            ListView {
                                Layout.fillWidth: true; Layout.fillHeight: true
                                clip: true
                                model: lyricsLoader.getAllLines()
                                currentIndex: lyricsLoader.currentIndex

                                delegate: Rectangle {
                                    width: ListView.view.width; height: 32
                                    color: lyricsLoader.currentIndex === index ? window.bgElevated : "transparent"
                                    border.color: lyricsLoader.currentIndex === index ? window.lavaRed : "transparent"
                                    border.width: 1; radius: 4

                                    Row {
                                        anchors.verticalCenter: parent.verticalCenter; anchors.left: parent.left; anchors.leftMargin: 8; spacing: 8
                                        Text {
                                            text: {
                                                let ms = modelData.timeMs; let s = Math.floor(ms/1000); let m = Math.floor(s/60)
                                                return String(m).padStart(2,'0') + ":" + String(s%60).padStart(2,'0')
                                            }
                                            color: window.textMuted; font.pixelSize: 10; font.family: "Consolas"
                                        }
                                        Text { text: modelData.text; color: lyricsLoader.currentIndex === index ? window.textPrimary : window.textSecondary; font.pixelSize: 11; elide: Text.ElideRight; width: 170 }
                                    }
                                }

                                onCurrentIndexChanged: {
                                    if (currentIndex >= 0) positionViewAtIndex(currentIndex, ListView.Center)
                                }
                            }
                        }
                    }

                    // ── Center: Viewport + Controls ────────────────────────
                    ColumnLayout {
                        SplitView.fillWidth: true
                        spacing: 0

                        // Video viewport area
                        Rectangle {
                            Layout.fillWidth: true; Layout.fillHeight: true
                            color: window.bgDeep

                            // 9:16 phone container
                            Item {
                                id: phoneContainer
                                anchors.centerIn: parent
                                height: Math.min(parent.height - 16, 600)
                                width: height * 9 / 16

                                Rectangle {
                                    anchors.fill: parent; radius: 16; clip: true
                                    color: "#000"
                                    border.color: window.borderSubtle; border.width: 1

                                    // Video frame placeholder / real frame via Image
                                    Rectangle {
                                        anchors.fill: parent; color: "#080808"
                                        Text {
                                            anchors.centerIn: parent
                                            text: mediaEngine.mediaPath === "" ? "🎬\nArrasta un video\nal timeline" : "▶ Preview"
                                            color: window.textMuted; font.pixelSize: 14
                                            horizontalAlignment: Text.AlignHCenter
                                            wrapMode: Text.WordWrap
                                        }
                                    }

                                    // Safe zone overlay
                                    Rectangle {
                                        anchors.fill: parent
                                        anchors.topMargin: parent.height * 0.10
                                        anchors.bottomMargin: parent.height * 0.15
                                        anchors.leftMargin: parent.width * 0.06
                                        anchors.rightMargin: parent.width * 0.06
                                        color: "transparent"
                                        border.color: "#ff3e3e33"; border.width: 1
                                    }

                                    // Lyrics overlay
                                    Column {
                                        anchors.centerIn: parent
                                        width: parent.width * 0.86
                                        spacing: 10

                                        Text {
                                            text: lyricsLoader.prevLine
                                            width: parent.width; horizontalAlignment: Text.AlignHCenter
                                            font.pixelSize: phoneContainer.height * 0.026
                                            font.bold: true; color: "#888"; wrapMode: Text.WordWrap
                                            opacity: 0.7
                                            style: Text.Outline; styleColor: "#000"
                                        }
                                        Text {
                                            text: lyricsLoader.currentLine !== "" ? lyricsLoader.currentLine : "♪"
                                            width: parent.width; horizontalAlignment: Text.AlignHCenter
                                            font.pixelSize: phoneContainer.height * 0.045
                                            font.bold: true; color: "#ffffff"; wrapMode: Text.WordWrap
                                            style: Text.Outline; styleColor: "#000000"

                                            Behavior on text {
                                                SequentialAnimation {
                                                    NumberAnimation { target: lyricsLine; property: "scale"; to: 0.9; duration: 80 }
                                                    NumberAnimation { target: lyricsLine; property: "scale"; to: 1.0; duration: 120; easing.type: Easing.OutBack }
                                                }
                                            }
                                            id: lyricsLine
                                        }
                                        Text {
                                            text: lyricsLoader.nextLine
                                            width: parent.width; horizontalAlignment: Text.AlignHCenter
                                            font.pixelSize: phoneContainer.height * 0.026
                                            font.bold: true; color: "#888"; wrapMode: Text.WordWrap
                                            opacity: 0.7
                                            style: Text.Outline; styleColor: "#000"
                                        }
                                    }

                                    // Time overlay (top-left)
                                    Text {
                                        anchors.top: parent.top; anchors.left: parent.left
                                        anchors.margins: 8
                                        text: mediaEngine.formatTime(mediaEngine.position) + " / " + mediaEngine.formatTime(mediaEngine.duration)
                                        color: "#ffffff80"; font.pixelSize: 10; font.family: "Consolas"
                                    }
                                }
                            }
                        }

                        // Transport controls
                        Rectangle {
                            Layout.fillWidth: true; height: 60
                            color: window.bgDark
                            border.color: window.borderSubtle; border.width: 1

                            ColumnLayout {
                                anchors.fill: parent; anchors.margins: 8; spacing: 4

                                // Seek bar
                                Slider {
                                    id: seekBar
                                    Layout.fillWidth: true; height: 16
                                    from: 0; to: Math.max(1, mediaEngine.duration)
                                    value: mediaEngine.position
                                    enabled: mediaEngine.duration > 0

                                    onMoved: mediaEngine.seek(value)

                                    background: Rectangle {
                                        x: seekBar.leftPadding; y: seekBar.topPadding + seekBar.availableHeight / 2 - height / 2
                                        width: seekBar.availableWidth; height: 4; radius: 2
                                        color: window.bgElevated
                                        Rectangle {
                                            width: seekBar.visualPosition * parent.width; height: parent.height; radius: 2
                                            gradient: Gradient {
                                                orientation: Gradient.Horizontal
                                                GradientStop { position: 0; color: window.lavaRed }
                                                GradientStop { position: 1; color: window.lavaOrange }
                                            }
                                        }
                                    }
                                    handle: Rectangle {
                                        x: seekBar.leftPadding + seekBar.visualPosition * seekBar.availableWidth - width / 2
                                        y: seekBar.topPadding + seekBar.availableHeight / 2 - height / 2
                                        width: 14; height: 14; radius: 7
                                        color: window.lavaRed
                                        border.color: "#fff"; border.width: 1
                                    }
                                }

                                // Playback buttons
                                RowLayout {
                                    Layout.alignment: Qt.AlignHCenter; spacing: 8
                                    Repeater {
                                        model: [
                                            {text: "⏮", tip: "Inicio"},
                                            {text: "⏪", tip: "-10s"},
                                            {text: mediaEngine.isPlaying ? "⏸" : "▶", tip: "Play/Pausa", big: true},
                                            {text: "⏩", tip: "+10s"},
                                            {text: "⏭", tip: "Fin"},
                                        ]
                                        Button {
                                            text: modelData.text
                                            implicitWidth: modelData.big ? 48 : 36; implicitHeight: 32
                                            ToolTip.visible: hovered; ToolTip.text: modelData.tip
                                            onClicked: {
                                                if      (index === 0) mediaEngine.seek(0)
                                                else if (index === 1) mediaEngine.seek(Math.max(0, mediaEngine.position - 10))
                                                else if (index === 2) mediaEngine.isPlaying ? mediaEngine.pause() : mediaEngine.play()
                                                else if (index === 3) mediaEngine.seek(Math.min(mediaEngine.duration, mediaEngine.position + 10))
                                                else if (index === 4) mediaEngine.seek(mediaEngine.duration)
                                            }
                                            contentItem: Text { text: parent.text; color: window.textPrimary; font.pixelSize: modelData.big ? 18 : 14; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                            background: Rectangle { color: parent.hovered ? window.bgElevated : "transparent"; radius: 6 }
                                        }
                                    }

                                    // Volume slider
                                    Text { text: "🔊"; color: window.textMuted; font.pixelSize: 12 }
                                    Slider {
                                        id: volSlider; from: 0; to: 1; value: mediaEngine.volume
                                        implicitWidth: 80; implicitHeight: 20
                                        onMoved: mediaEngine.volume = value
                                        background: Rectangle {
                                            x: volSlider.leftPadding; y: volSlider.topPadding + volSlider.availableHeight/2 - height/2
                                            width: volSlider.availableWidth; height: 3; radius: 2; color: window.bgElevated
                                            Rectangle { width: volSlider.visualPosition * parent.width; height: parent.height; radius: 2; color: window.textSecondary }
                                        }
                                        handle: Rectangle {
                                            x: volSlider.leftPadding + volSlider.visualPosition * volSlider.availableWidth - width/2
                                            y: volSlider.topPadding + volSlider.availableHeight/2 - height/2
                                            width: 10; height: 10; radius: 5; color: window.textSecondary
                                        }
                                    }

                                    // Zoom
                                    Text { text: "🔍"; color: window.textMuted; font.pixelSize: 12; Layout.leftMargin: 8 }
                                    Slider {
                                        from: 20; to: 300; value: timelineScale
                                        implicitWidth: 80; implicitHeight: 20
                                        onMoved: timelineScale = value
                                        background: Rectangle {
                                            x: parent.leftPadding; y: parent.topPadding + parent.availableHeight/2 - height/2
                                            width: parent.availableWidth; height: 3; radius: 2; color: window.bgElevated
                                            Rectangle { width: parent.parent.visualPosition * parent.width; height: parent.height; radius: 2; color: window.textMuted }
                                        }
                                        handle: Rectangle {
                                            x: parent.leftPadding + parent.visualPosition * parent.availableWidth - width/2
                                            y: parent.topPadding + parent.availableHeight/2 - height/2
                                            width: 10; height: 10; radius: 5; color: window.textMuted
                                        }
                                    }
                                }
                            }
                        }

                        // ── Timeline ───────────────────────────────────────
                        Rectangle {
                            Layout.fillWidth: true; height: 200
                            color: window.bgDark
                            border.color: window.borderSubtle; border.width: 1

                            ColumnLayout {
                                anchors.fill: parent; spacing: 0

                                // Timeline header (track labels + ruler)
                                RowLayout {
                                    height: 28; Layout.fillWidth: true; spacing: 0

                                    Rectangle {
                                        width: 110; height: parent.height; color: "#121220"
                                        Text { anchors.centerIn: parent; text: "Pistas"; color: window.textMuted; font.pixelSize: 10 }
                                    }

                                    // Time ruler
                                    ScrollView {
                                        id: rulerScroll
                                        Layout.fillWidth: true; height: parent.height; clip: true

                                        Row {
                                            width: Math.max(timelineScroll.contentWidth, 2000)
                                            height: 28

                                            Repeater {
                                                model: Math.ceil(Math.max(mediaEngine.duration, 60) / 5) + 1
                                                Item {
                                                    width: 5 * timelineScale; height: 28
                                                    Rectangle {
                                                        width: 1; height: 12; color: window.borderSubtle
                                                        anchors.top: parent.top
                                                    }
                                                    Text {
                                                        text: {
                                                            let s = index * 5; let m = Math.floor(s/60)
                                                            return String(m).padStart(2,'0') + ":" + String(s%60).padStart(2,'0')
                                                        }
                                                        anchors.top: parent.top; anchors.topMargin: 12; anchors.left: parent.left; anchors.leftMargin: 3
                                                        color: window.textMuted; font.pixelSize: 9; font.family: "Consolas"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                // Timeline tracks
                                ScrollView {
                                    id: timelineScroll
                                    Layout.fillWidth: true; Layout.fillHeight: true; clip: true

                                    ColumnLayout {
                                        spacing: 2; width: Math.max(mediaEngine.duration * timelineScale + 200, 2000)

                                        Repeater {
                                            model: [
                                                {name: "🎬 Video",        track: "video",  color: "#152535", border: "#355575", textColor: "#79aada"},
                                                {name: "🎵 Audio/Letras", track: "audio",  color: "#251525", border: "#753555", textColor: "#da7979"},
                                            ]
                                            RowLayout {
                                                height: 48; spacing: 0

                                                // Track label
                                                Rectangle {
                                                    width: 110; height: parent.height; color: "#121220"
                                                    border.color: window.borderSubtle; border.width: 1
                                                    Text { anchors.centerIn: parent; text: modelData.name; color: window.textSecondary; font.pixelSize: 10 }
                                                }

                                                // Track lane
                                                Rectangle {
                                                    Layout.fillWidth: true; height: parent.height
                                                    color: "#0f0f1a"
                                                    border.color: window.borderSubtle; border.width: 1
                                                    clip: true

                                                    // Drop zone
                                                    DropArea {
                                                        anchors.fill: parent
                                                        onDropped: {
                                                            if (drop.hasUrls) {
                                                                let path = drop.urls[0].toString().replace("file:///","")
                                                                let startSec = drop.x / timelineScale
                                                                timeline.addClip(modelData.track, path, modelData.track, startSec, 30, 0)
                                                            }
                                                        }
                                                    }

                                                    // Clips
                                                    Repeater {
                                                        model: timeline.getClips(modelData.track)
                                                        Rectangle {
                                                            x: modelData.start * timelineScale
                                                            width: modelData.duration * timelineScale
                                                            height: parent.height - 4; y: 2; radius: 4
                                                            color: modelData.color; border.color: modelData.border; border.width: 1
                                                            Text {
                                                                anchors.centerIn: parent
                                                                text: modelData.id.split("/").pop().split("\\").pop()
                                                                color: modelData.textColor; font.pixelSize: 10; elide: Text.ElideRight; width: parent.width - 8
                                                                horizontalAlignment: Text.AlignHCenter
                                                            }
                                                            DragHandler { onActiveChanged: if (!active) timeline.moveClip(modelData.track, modelData.id, x / timelineScale) }
                                                        }
                                                    }

                                                    // Playhead
                                                    Rectangle {
                                                        x: mediaEngine.position * timelineScale - 1
                                                        width: 2; height: parent.height
                                                        color: window.lavaRed; opacity: 0.9
                                                        Rectangle { width: 8; height: 8; radius: 4; color: window.lavaRed; anchors.horizontalCenter: parent.horizontalCenter; y: -4 }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Status bar ─────────────────────────────────────────────────────
        Rectangle {
            id: statusBarRect
            Layout.fillWidth: true; height: 24
            color: window.bgDark; border.color: window.borderSubtle; border.width: 1

            RowLayout {
                anchors.fill: parent; anchors.leftMargin: 12; anchors.rightMargin: 12

                Text {
                    id: statusBarText
                    text: "LavaLyrics C++ listo"
                    color: window.textMuted; font.pixelSize: 11
                }
                Item { Layout.fillWidth: true }
                Text {
                    text: mediaEngine.duration > 0
                          ? mediaEngine.formatTime(mediaEngine.position) + " / " + mediaEngine.formatTime(mediaEngine.duration)
                          : ""
                    color: window.textMuted; font.pixelSize: 10; font.family: "Consolas"
                }
                Text {
                    text: lyricsLoader.isLoaded ? "📝 " + lyricsLoader.currentLine : ""
                    color: window.lavaRed; font.pixelSize: 10
                    elide: Text.ElideRight; maximumLineCount: 1; width: 300
                }
            }

            Timer {
                id: statusClearTimer
                interval: 4000
                onTriggered: statusBarText.text = "LavaLyrics C++ listo"
            }

            function showMsg(msg) {
                statusBarText.text = msg
                statusClearTimer.restart()
            }
        }

        QtObject { id: statusBar; function showMsg(msg) { statusBarRect.showMsg(msg) } }
    }
}
