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

    Connections {
        target: projectMgr
        function onProjectLoaded(data) {
            statusBar.showMsg("📂 Proyecto cargado con éxito")
            currentScreen = 2 // Go to Editor screen
            if (data.audioPath && data.audioPath !== "") {
                mediaEngine.loadMedia(data.audioPath)
            }
            if (data.lyricsPath && data.lyricsPath !== "") {
                if (data.lyricsPath.endsWith(".lrc")) lyricsLoader.loadLrc(data.lyricsPath)
                else lyricsLoader.loadJson(data.lyricsPath)
            }
        }
        function onErrorOccurred(message) {
            statusBar.showMsg("❌ Error de proyecto: " + message)
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
        id: loadProjectDialog
        title: "Abrir Proyecto LavaLyrics"
        nameFilters: ["LavaLyrics Project (*.lavalyrics)"]
        onAccepted: {
            projectMgr.loadProject(selectedFile.toString().replace("file:///", ""))
        }
    }

    FileDialog {
        id: saveProjectDialog
        title: "Guardar proyecto"
        fileMode: FileDialog.SaveFile
        nameFilters: ["LavaLyrics Project (*.lavalyrics)"]
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

    FolderDialog {
        id: selectWorkspaceDialog
        title: "Seleccionar Carpeta de Trabajo"
        currentFolder: "file:///C:/Users/" + Qt.platform.os + "/Documents/LavaLyricsProjects/ACALOSPROJECTOS"
        onAccepted: {
            workspaceDirField.text = selectedFolder.toString().replace("file:///", "")
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
                            text: "C:/Users/" + Qt.platform.os + "/Documents/LavaLyricsProjects/ACALOSPROJECTOS"
                            color: window.textSecondary; background: Item {}
                            font.pixelSize: 11; placeholderTextColor: window.textMuted
                        }
                        Button {
                            text: "Examinar..."
                            implicitWidth: 90
                            Layout.fillHeight: true
                            onClicked: selectWorkspaceDialog.open()
                            contentItem: Text { text: parent.text; color: window.textPrimary; font.pixelSize: 11; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                            background: Rectangle { color: parent.hovered ? window.bgElevated : window.bgDark; border.color: window.borderSubtle; border.width: 1; radius: 4 }
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
                        currentScreen = 2 // Go directly to Editor screen (skipping download screen)
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
                        model: ["🏠 Inicio", "🎬 Editor"]
                        Button {
                            text: modelData
                            onClicked: {
                                // Maps 0 -> 0 (Inicio), 1 -> 2 (Editor)
                                currentScreen = (index === 0) ? 0 : 2
                            }
                            contentItem: Text {
                                text: parent.text; color: currentScreen === (index === 0 ? 0 : 2) ? window.lavaRed : window.textSecondary
                                font.pixelSize: 12; font.bold: currentScreen === (index === 0 ? 0 : 2)
                                horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter
                            }
                            background: Rectangle {
                                color: currentScreen === (index === 0 ? 0 : 2) ? window.bgElevated : "transparent"
                                border.color: currentScreen === (index === 0 ? 0 : 2) ? window.lavaRed : "transparent"
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

                    // Main Action Cards Row
                    RowLayout {
                        spacing: 24
                        Layout.alignment: Qt.AlignHCenter

                        // Nuevo Proyecto Card
                        Rectangle {
                            width: 250; height: 140
                            color: window.bgCard
                            border.color: newProjectMouse.containsMouse ? window.lavaRed : window.borderSubtle
                            border.width: 1; radius: 12
                            
                            Rectangle {
                                anchors.fill: parent; radius: 12; z: -1
                                color: "transparent"; border.color: window.lavaRed; border.width: 2
                                opacity: newProjectMouse.containsMouse ? 0.3 : 0
                            }

                            Column {
                                anchors.centerIn: parent
                                spacing: 8
                                Text { text: "➕"; font.pixelSize: 28; anchors.horizontalCenter: parent.horizontalCenter }
                                Text { text: "NUEVO PROYECTO"; font.pixelSize: 13; font.bold: true; color: window.textPrimary; anchors.horizontalCenter: parent.horizontalCenter }
                                Text { text: "Comienza una nueva creación"; font.pixelSize: 10; color: window.textMuted; anchors.horizontalCenter: parent.horizontalCenter }
                            }

                            MouseArea {
                                id: newProjectMouse
                                anchors.fill: parent; hoverEnabled: true
                                onClicked: createProjectDialog.open()
                            }
                        }

                        // Abrir Proyecto Card
                        Rectangle {
                            width: 250; height: 140
                            color: window.bgCard
                            border.color: openProjectMouse.containsMouse ? window.lavaPurple : window.borderSubtle
                            border.width: 1; radius: 12
                            
                            Rectangle {
                                anchors.fill: parent; radius: 12; z: -1
                                color: "transparent"; border.color: window.lavaPurple; border.width: 2
                                opacity: openProjectMouse.containsMouse ? 0.3 : 0
                            }

                            Column {
                                anchors.centerIn: parent
                                spacing: 8
                                Text { text: "📂"; font.pixelSize: 28; anchors.horizontalCenter: parent.horizontalCenter }
                                Text { text: "ABRIR PROYECTO"; font.pixelSize: 13; font.bold: true; color: window.textPrimary; anchors.horizontalCenter: parent.horizontalCenter }
                                Text { text: "Carga un archivo .lavalyrics"; font.pixelSize: 10; color: window.textMuted; anchors.horizontalCenter: parent.horizontalCenter }
                            }

                            MouseArea {
                                id: openProjectMouse
                                anchors.fill: parent; hoverEnabled: true
                                onClicked: loadProjectDialog.open()
                            }
                        }
                    }

                    // Table with recent projects
                    ColumnLayout {
                        spacing: 8
                        Layout.alignment: Qt.AlignHCenter
                        Layout.preferredWidth: 600
                        visible: projectMgr.recentProjects().length > 0

                        Text {
                            text: "Proyectos recientes"
                            color: window.textSecondary; font.pixelSize: 13; font.bold: true
                            Layout.alignment: Qt.AlignLeft
                        }

                        // Recent projects table header
                        Rectangle {
                            Layout.fillWidth: true; height: 28
                            color: window.bgDark
                            border.color: window.borderSubtle; border.width: 1
                            radius: 6

                            RowLayout {
                                anchors.fill: parent; anchors.leftMargin: 12; anchors.rightMargin: 12
                                Text { text: "Nombre de Proyecto"; color: window.textMuted; font.pixelSize: 10; Layout.fillWidth: true }
                                Text { text: "Ubicación"; color: window.textMuted; font.pixelSize: 10; Layout.preferredWidth: 280 }
                            }
                        }

                        // Table rows
                        Repeater {
                            model: projectMgr.recentProjects().slice(0, 5)
                            Rectangle {
                                Layout.fillWidth: true; height: 36
                                color: rowMouse.containsMouse ? window.bgElevated : "transparent"
                                border.color: window.borderSubtle; border.width: 1
                                radius: 6

                                RowLayout {
                                    anchors.fill: parent; anchors.leftMargin: 12; anchors.rightMargin: 12
                                    Text {
                                        text: "📁  " + modelData.split("/").pop().split("\\").pop().replace(".lavalyrics", "").replace(".llproj", "")
                                        color: window.textPrimary; font.pixelSize: 11; font.bold: true
                                        Layout.fillWidth: true
                                    }
                                    Text {
                                        text: modelData
                                        color: window.textMuted; font.pixelSize: 10; elide: Text.ElideLeft
                                        Layout.preferredWidth: 280
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

            // ── EDITOR SCREEN ──────────────────────────────────────────────
            Item {
                anchors.fill: parent
                visible: currentScreen === 2

                SplitView {
                    anchors.fill: parent
                    orientation: Qt.Vertical

                    // ── SECCIÓN SUPERIOR (Inspector vs Previsualización) ──
                    SplitView {
                        SplitView.preferredHeight: parent.height * 0.58
                        SplitView.minimumHeight: 220
                        orientation: Qt.Horizontal

                        // [Cuadrante Izquierda Arriba] Inspector
                        Rectangle {
                            SplitView.preferredWidth: 300
                            SplitView.minimumWidth: 180
                            color: window.bgDark
                            border.color: window.borderSubtle; border.width: 1

                            ColumnLayout {
                                anchors.fill: parent; anchors.margins: 12; spacing: 10
                                Text { text: "🔍 Inspector"; font.pixelSize: 13; font.bold: true; color: window.textPrimary }
                                Rectangle { Layout.fillWidth: true; height: 1; color: window.borderSubtle }
                                Text { text: "Detalles del Proyecto"; color: window.textSecondary; font.pixelSize: 11; font.bold: true }
                                Text { text: "Nombre: " + projectMgr.projectName; color: window.textMuted; font.pixelSize: 11 }
                                Text { text: "Archivo: " + (projectMgr.projectPath === "" ? "Sin guardar" : projectMgr.projectPath.split("/").pop()); color: window.textMuted; font.pixelSize: 11 }
                                Text { text: "Ruta completa:"; color: window.textSecondary; font.pixelSize: 10 }
                                Text { text: projectMgr.projectPath; color: window.textMuted; font.pixelSize: 9; wrapMode: Text.WrapAnywhere; Layout.fillWidth: true }
                                Item { Layout.fillHeight: true }
                            }
                        }

                        // [Cuadrante Derecha Arriba] Previsualización (Preview)
                        Rectangle {
                            SplitView.fillWidth: true
                            color: window.bgDeep
                            border.color: window.borderSubtle; border.width: 1

                            ColumnLayout {
                                anchors.fill: parent; spacing: 0

                                // Video viewport area
                                Rectangle {
                                    Layout.fillWidth: true; Layout.fillHeight: true; color: "transparent"

                                    // 9:16 phone container
                                    Item {
                                        id: phoneContainer
                                        anchors.centerIn: parent
                                        height: Math.min(parent.height - 16, 500)
                                        width: height * 9 / 16

                                        Rectangle {
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
