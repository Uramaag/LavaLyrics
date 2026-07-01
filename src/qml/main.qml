import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import Qt.labs.settings 1.0
import LavaLyrics 1.0

ApplicationWindow {
    id: window
    visible: true
    minimumWidth: 1100
    minimumHeight: 700
    title: projectMgr.isDirty
           ? "● LavaLyrics C++ — " + projectMgr.projectName
           : "LavaLyrics C++ — " + projectMgr.projectName

    // Persistencia de la geometría y estado de la ventana
    Settings {
        category: "Window"
        property alias x: window.x
        property alias y: window.y
        property alias width: window.width
        property alias height: window.height
        property alias visibility: window.visibility
    }

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
    property string selectedClipId: ""
    property string selectedClipTrack: ""
    property var selectedClip: selectedClipId !== "" ? timeline.getClip(selectedClipId) : ({})
    property string libraryViewMode: "cards"
    property string toastMessage: ""
    property string toastType: "info"
    property string lastDownloadKey: ""
    property bool   showGuides: true
    property string savingStatus: "idle" // "idle", "saving", "saved"

    function basename(path) {
        return String(path || "").split("/").pop().split("\\").pop()
    }

    function isAudioPath(path) {
        let p = String(path || "").toLowerCase()
        return p.endsWith(".mp3") || p.endsWith(".m4a") || p.endsWith(".flac") || p.endsWith(".wav") || p.endsWith(".opus")
    }

    function importMediaToLibrary(path) {
        if (!path) return
        let name = basename(path)
        if (isAudioPath(path)) {
            mediaEngine.loadMedia(path)
            timeline.addMediaClip("A1", "audio", name, path, 0, Math.max(15, mediaEngine.duration || 15), 0)
        } else {
            timeline.addMediaClip("V1", "video", name, path, 0, 15, 0)
            mediaEngine.loadMedia(path)
        }
        let pData = projectMgr.getProjectData()
        pData["timelineVideo"] = timeline.getVideoClips()
        pData["timelineAudio"] = timeline.getAudioClips()
        projectMgr.setProjectData(pData)
        projectMgr.markDirty()
        currentScreen = 2
    }

    function firstAudioPath() {
        let clips = timeline.getAudioClips()
        return clips.length > 0 ? clips[0].path : mediaEngine.mediaPath
    }

    function showToast(message, type) {
        toastMessage = String(message || "")
        toastType = type || "info"
        toastTimer.restart()
    }

    function hasDownloadedSong(query) {
        let q = String(query || "").toLowerCase()
        let clips = timeline.getAudioClips()
        for (let i = 0; i < clips.length; i++) {
            let name = String(clips[i].name || clips[i].path || "").toLowerCase()
            if (q !== "" && name.indexOf(q) >= 0) return true
        }
        return false
    }

    function songArtist(query) {
        let parts = String(query || "").split(" - ")
        return parts.length > 1 ? parts[0].trim() : "Artista por detectar"
    }

    function songTitle(query) {
        let parts = String(query || "").split(" - ")
        return parts.length > 1 ? parts.slice(1).join(" - ").trim() : String(query || "").trim()
    }

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
            showToast("Descarga completada: " + basename(audioPath) + (lyricsPath !== "" ? "\nLyrics sincronizadas importadas." : "\nSin lyrics sincronizadas."), "success")
            if (audioPath !== "") mediaEngine.loadMedia(audioPath)
            if (lyricsPath !== "") {
                if (lyricsPath.endsWith(".lrc"))  lyricsLoader.loadLrc(lyricsPath)
                if (lyricsPath.endsWith(".json")) lyricsLoader.loadJson(lyricsPath)
            }
            if (audioPath !== "") {
                timeline.addSongClips(basename(audioPath), audioPath, lyricsPath, 0, Math.max(15, mediaEngine.duration || 180), lyricsLoader.getAllLines())
                projectMgr.markDirty()
            }
            currentScreen = 2
        }
        function onDownloadFailed(error) {
            statusBar.showMsg("❌ Error: " + error)
            showToast("No se pudo descargar la canción.\n" + error, "error")
        }
        function onSearchStarted() {
            songSearchModal.results = [
                {title: "Buscando en internet...", artist: "Consultando YouTube y LRCLIB", source: "Busqueda real", icon: "...", hasLyrics: false, downloaded: false, duration: "Espere", url: ""}
            ]
        }
        function onSearchCompleted(results) {
            for (let i = 0; i < results.length; i++) {
                results[i].downloaded = hasDownloadedSong(results[i].title) || hasDownloadedSong(results[i].artist + " - " + results[i].title)
                if (!results[i].duration || results[i].duration === "") results[i].duration = "No disponible"
                if (!results[i].icon || results[i].icon === "") results[i].icon = "YT"
            }
            songSearchModal.results = results
            if (results.length === 0) {
                showToast("No se encontraron canciones reales para esa busqueda.", "info")
            }
        }
        function onSearchFailed(error) {
            songSearchModal.results = []
            showToast("No se pudo buscar canciones.\n" + error, "error")
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
            if (data.audioPath && data.audioPath !== "") {
                mediaEngine.loadMedia(data.audioPath)
            }
            if (data.lyricsPath && data.lyricsPath !== "") {
                if (data.lyricsPath.endsWith(".lrc")) lyricsLoader.loadLrc(data.lyricsPath)
                else lyricsLoader.loadJson(data.lyricsPath)
            }
            currentScreen = 2
        }
    }

    // ── File dialogs ───────────────────────────────────────────────────────
    FileDialog {
        id: openMediaDialog
        title: "Abrir archivo de audio/video"
        nameFilters: ["Archivos de audio/video (*.mp3 *.m4a *.flac *.wav *.mp4 *.mov *.mkv)", "Todos (*)"]
        onAccepted: {
            let path = selectedFile.toString().replace("file:///", "")
            importMediaToLibrary(path)
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
            let pData = projectMgr.getProjectData()
            pData["lyricsPath"] = p
            projectMgr.setProjectData(pData)
            projectMgr.markDirty()
        }
    }

    FileDialog {
        id: openProjectDialog
        title: "Abrir proyecto LavaLyrics"
        nameFilters: ["LavaLyrics Project (*.llproj)", "Todos (*)"]
        onAccepted: {
            let path = selectedFile.toString().replace("file:///", "")
            projectMgr.loadProject(path)
            currentScreen = 2 // Ir al editor
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

    FolderDialog {
        id: newProjectFolderDialog
        title: "Selecciona la carpeta para tu proyecto"
        currentFolder: "file:///C:/Users/urama/OneDrive/Documents/LavaLyricsProjects"
        onAccepted: {
            txtProjectLocation.text = selectedFolder.toString().replace("file:///", "")
        }
    }

    Window {
        id: songSearchModal
        visible: false
        width: 620; height: 520
        title: "Añadir canción"
        flags: Qt.Dialog | Qt.WindowTitleHint | Qt.WindowCloseButtonHint
        modality: Qt.ApplicationModal
        color: window.bgDark

        property string query: ""
        property var results: []

        function startDownload(result) {
            let target = result.url || songSearchField.text.trim()
            if (target === "") return
            window.lastDownloadKey = (result.title || target).toLowerCase()
            window.showToast("Iniciando descarga desde " + result.source + "...\n" + (result.artist || "") + " - " + (result.title || target), "info")
            try {
                downloader.downloadFromUrl(target, outDirField.text.trim())
                songSearchModal.visible = false
            } catch (err) {
                window.showToast("Error al iniciar la descarga.\n" + err, "error")
            }
        }

        Timer {
            id: songSearchDebounce
            interval: 450
            repeat: false
            onTriggered: {
                let q = songSearchField.text.trim()
                songSearchModal.query = q
                if (q === "") {
                    songSearchModal.results = []
                } else {
                    songSearchModal.results = []
                    downloader.searchSongs(q)
                }
            }
        }

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 18
            spacing: 12

            Text { text: "Buscar cancion"; color: window.textPrimary; font.pixelSize: 18; font.bold: true }
            Text { text: "Busca por artista, cancion o pega una URL. Se priorizan resultados con lyrics sincronizadas."; color: window.textSecondary; font.pixelSize: 11; wrapMode: Text.WordWrap; Layout.fillWidth: true }

            TextField {
                id: songSearchField
                Layout.fillWidth: true
                placeholderText: "Ej. Bad Bunny Monaco, Spotify URL, YouTube Music..."
                color: window.textPrimary
                background: Rectangle { color: window.bgCard; border.color: parent.activeFocus ? window.lavaRed : window.borderSubtle; radius: 6 }
                onTextChanged: songSearchDebounce.restart()
                onAccepted: {
                    songSearchModal.startDownload({source: "busqueda"})
                    songSearchModal.visible = false
                }
            }

            ScrollView {
                Layout.fillWidth: true
                Layout.fillHeight: true
                clip: true
                ColumnLayout {
                    width: songSearchModal.width - 50
                    spacing: 8
                    Repeater {
                        model: songSearchModal.results
                        Rectangle {
                            Layout.fillWidth: true
                            height: 104
                            color: window.bgCard
                            border.color: modelData.hasLyrics ? "#4caf50" : window.borderSubtle
                            radius: 6
                            RowLayout {
                                anchors.fill: parent
                                anchors.margins: 10
                                spacing: 10
                                Rectangle {
                                    width: 54; height: 54
                                    color: "#161a22"
                                    border.color: window.borderSubtle
                                    radius: 5
                                    Column {
                                        anchors.centerIn: parent
                                        spacing: 3
                                        Text { anchors.horizontalCenter: parent.horizontalCenter; text: modelData.icon; color: "#fff"; font.pixelSize: 11; font.bold: true }
                                        Text { anchors.horizontalCenter: parent.horizontalCenter; text: "Fuente"; color: window.textMuted; font.pixelSize: 7 }
                                    }
                                }
                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 5
                                    Text { text: modelData.title; color: window.textPrimary; font.bold: true; font.pixelSize: 13; elide: Text.ElideRight; Layout.fillWidth: true }
                                    Text { text: "Artista: " + modelData.artist; color: window.textSecondary; font.pixelSize: 10; elide: Text.ElideRight; Layout.fillWidth: true }
                                    Text { text: "Plataforma: " + modelData.source + "    Duracion: " + modelData.duration; color: window.textMuted; font.pixelSize: 9; elide: Text.ElideRight; Layout.fillWidth: true }
                                    Text { text: modelData.artist + " · " + modelData.source; color: window.textMuted; font.pixelSize: 10; elide: Text.ElideRight; Layout.fillWidth: true }
                                    RowLayout {
                                        spacing: 6
                                        Rectangle {
                                            height: 20; width: lyricBadgeText.implicitWidth + 14; radius: 4
                                            color: modelData.hasLyrics ? "#143d25" : "#3b3030"
                                            border.color: modelData.hasLyrics ? "#4caf50" : "#8a6a6a"
                                            Text { id: lyricBadgeText; anchors.centerIn: parent; text: modelData.hasLyrics ? "Lyrics sincronizadas" : "Sin lyrics"; color: "#fff"; font.pixelSize: 9; font.bold: true }
                                        }
                                        Rectangle {
                                            height: 20; width: downloadBadgeText.implicitWidth + 14; radius: 4
                                            color: modelData.downloaded ? "#253f61" : "#3a3420"
                                            border.color: modelData.downloaded ? "#6aa7ff" : "#c9a64b"
                                            Text { id: downloadBadgeText; anchors.centerIn: parent; text: modelData.downloaded ? "Descargado" : "Pendiente"; color: "#fff"; font.pixelSize: 9; font.bold: true }
                                        }
                                    }
                                }
                                Button {
                                    text: modelData.downloaded ? "Insertar" : "Descargar"
                                    enabled: modelData.url !== ""
                                    onClicked: {
                                        if (modelData.downloaded) {
                                            showToast("La cancion ya aparece como descargada en la timeline.", "info")
                                            songSearchModal.visible = false
                                        } else {
                                            songSearchModal.startDownload(modelData)
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

    // Modal para Nuevo Proyecto estilo Adobe Premiere
    Window {
        id: newProjectModal
        visible: false
        width: 600; height: 380
        title: "Crear Proyecto — LavaLyrics"
        flags: Qt.Dialog | Qt.WindowTitleHint | Qt.WindowCloseButtonHint
        color: window.bgDark
        modality: Qt.ApplicationModal

        RowLayout {
            anchors.fill: parent
            anchors.margins: 20
            spacing: 24

            // Columna Izquierda: Formulario
            ColumnLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 14

                Text {
                    text: "✨ Crear nuevo proyecto"
                    font.pixelSize: 18; font.bold: true; color: window.textPrimary
                }

                // Nombre
                ColumnLayout {
                    spacing: 4
                    Layout.fillWidth: true
                    Text { text: "Nombre del proyecto"; font.pixelSize: 11; color: window.textSecondary }
                    TextField {
                        id: txtProjectName
                        Layout.fillWidth: true
                        text: "Mi Clip de Tiktok"
                        color: window.textPrimary
                        background: Rectangle { color: window.bgCard; border.color: parent.activeFocus ? window.lavaRed : window.borderSubtle; border.width: 1; radius: 6 }
                        font.pixelSize: 12
                        selectByMouse: true
                    }
                }

                // Relación de aspecto
                ColumnLayout {
                    spacing: 4
                    Layout.fillWidth: true
                    Text { text: "Relación de aspecto / Resolución"; font.pixelSize: 11; color: window.textSecondary }
                    ComboBox {
                        id: comboResolution
                        Layout.fillWidth: true
                        model: ["Vertical 9:16 (1080x1920)", "Horizontal 16:9 (1920x1080)"]
                        font.pixelSize: 12
                    }
                }

                // Ubicación (Examinar)
                ColumnLayout {
                    spacing: 4
                    Layout.fillWidth: true
                    Text { text: "Ubicación del proyecto"; font.pixelSize: 11; color: window.textSecondary }
                    RowLayout {
                        spacing: 8
                        TextField {
                            id: txtProjectLocation
                            Layout.fillWidth: true
                            text: "C:/Users/urama/OneDrive/Documents/LavaLyricsProjects"
                            color: window.textPrimary
                            background: Rectangle { color: window.bgCard; border.color: parent.activeFocus ? window.lavaRed : window.borderSubtle; border.width: 1; radius: 6 }
                            font.pixelSize: 11
                            selectByMouse: true
                        }
                        Button {
                            text: "📂 Examinar"
                            implicitHeight: 34
                            onClicked: newProjectFolderDialog.open()
                            contentItem: Text { text: parent.text; color: window.textPrimary; font.bold: true; font.pixelSize: 11; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                            background: Rectangle { color: parent.hovered ? window.bgElevated : window.bgCard; border.color: window.borderSubtle; border.width: 1; radius: 6 }
                        }
                    }
                }

                Item { Layout.fillHeight: true }

                RowLayout {
                    Layout.alignment: Qt.AlignRight
                    spacing: 12

                    Button {
                        text: "Cancelar"
                        onClicked: newProjectModal.visible = false
                        contentItem: Text { text: parent.text; color: window.textSecondary; font.pixelSize: 12; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                        background: Rectangle { color: parent.hovered ? window.bgElevated : "transparent"; border.color: window.borderSubtle; border.width: 1; radius: 6 }
                        implicitWidth: 90; implicitHeight: 34
                    }

                    Button {
                        text: "Crear"
                        onClicked: {
                            let res = comboResolution.currentText.indexOf("Vertical") >= 0 ? "1080x1920" : "1920x1080"
                            projectMgr.newProject(txtProjectName.text, txtProjectLocation.text, res)
                            newProjectModal.visible = false
                            currentScreen = 2 // Ir al editor
                        }
                        contentItem: Text { text: parent.text; color: "#fff"; font.bold: true; font.pixelSize: 12; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                        background: Rectangle { color: parent.hovered ? "#ff5252" : window.lavaRed; radius: 6 }
                        implicitWidth: 90; implicitHeight: 34
                    }
                }
            }

            // Columna Derecha: Mockup Visual de Relación de Aspecto
            ColumnLayout {
                Layout.alignment: Qt.AlignVCenter
                spacing: 10
                Layout.preferredWidth: 160

                Text {
                    text: "Previsualización"
                    font.pixelSize: 11; font.bold: true
                    color: window.textMuted
                    Layout.alignment: Qt.AlignHCenter
                }

                // Rectángulo dinámico
                Rectangle {
                    id: previewMockup
                    Layout.alignment: Qt.AlignHCenter
                    width: comboResolution.currentIndex === 0 ? 100 : 160
                    height: comboResolution.currentIndex === 0 ? 160 : 100
                    color: window.bgCard
                    border.color: window.lavaRed
                    border.width: 2
                    radius: 8

                    Behavior on width { NumberAnimation { duration: 250 } }
                    Behavior on height { NumberAnimation { duration: 250 } }

                    // Icono de video adentro
                    Column {
                        anchors.centerIn: parent
                        spacing: 6
                        Text {
                            text: comboResolution.currentIndex === 0 ? "📱" : "💻"
                            font.pixelSize: 24
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                        Text {
                            text: comboResolution.currentIndex === 0 ? "9:16\nVertical" : "16:9\nHorizontal"
                            font.pixelSize: 10
                            font.bold: true
                            color: window.textSecondary
                            horizontalAlignment: Text.AlignHCenter
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                    }
                }
            }
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
                {"resolution": comboResolution.currentText.indexOf("Vertical") >= 0 ? "1080x1920" : "1920x1080", "fps": 30, "bitrate": "9000k", "format": "mp4", "duration": Math.max(15, mediaEngine.duration || 15)},
                {
                    "audioPath":  firstAudioPath(),
                    "lyricsData": lyricsLoader.getAllLines(),
                    "videoClips": timeline.getVideoClips()
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
                    spacing: 8
                    Layout.alignment: Qt.AlignVCenter
                    Row {
                        spacing: 0
                        Text { text: "Lava"; font.pixelSize: 20; font.bold: true; color: window.textPrimary; font.family: "Segoe UI" }
                        Text { text: "Lyrics"; font.pixelSize: 20; font.bold: true; color: window.lavaRed; font.family: "Segoe UI" }
                    }
                    // Cofre de Minecraft
                    Text {
                        id: minecraftChest
                        text: "🧰"
                        font.pixelSize: 18
                        visible: currentScreen === 2
                        transformOrigin: Item.Center
                        opacity: window.savingStatus === "idle" ? 0.3 : 1.0

                        Behavior on opacity { NumberAnimation { duration: 300 } }

                        // Animación de rotación/pulso del cofre
                        RotationAnimation on rotation {
                            running: window.savingStatus === "saving"
                            from: 0; to: 360; duration: 1000; loops: Animation.Infinite
                        }

                        // Glow cuando es saved
                        SequentialAnimation on scale {
                            id: saveGlowAnim
                            running: false
                            NumberAnimation { to: 1.4; duration: 200; easing.type: Easing.OutBack }
                            NumberAnimation { to: 1.0; duration: 300; easing.type: Easing.InBack }
                        }

                        // Escuchar cambios de dirty para simular autoguardado
                        Connections {
                            target: projectMgr
                            function onIsDirtyChanged() {
                                if (projectMgr.isDirty) {
                                    window.savingStatus = "saving"
                                    saveTimer.restart()
                                }
                            }
                        }

                        Timer {
                            id: saveTimer
                            interval: 1500
                            onTriggered: {
                                window.savingStatus = "saved"
                                saveGlowAnim.start()
                                // Autoguardado silencioso
                                projectMgr.saveProject(projectMgr.projectPath)
                                idleTimer.start()
                            }
                        }

                        Timer {
                            id: idleTimer
                            interval: 2000
                            onTriggered: window.savingStatus = "idle"
                        }
                    }
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

                    Column {
                        spacing: 8
                        Layout.alignment: Qt.AlignHCenter
                        Row {
                            anchors.horizontalCenter: parent.horizontalCenter
                            Text { text: "Lava"; font.pixelSize: 56; font.bold: true; color: window.textPrimary }
                            Text { text: "Lyrics"; font.pixelSize: 56; font.bold: true; color: window.lavaRed }
                        }
                        Text {
                            text: "Crea clips musicales virales con letras sincronizadas"
                            font.pixelSize: 16; color: window.textSecondary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                        Text {
                            text: "v" + APP_VERSION + " — Powered by Qt6 + C++"
                            font.pixelSize: 11; color: window.textMuted
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                    }

                    Row {
                        spacing: 16
                        Layout.alignment: Qt.AlignHCenter

                        // Quick action cards
                        Repeater {
                            model: [
                                {icon: "➕", label: "Nuevo proyecto",     sub: "Comenzar desde cero",    action: 0},
                                {icon: "⬇️", label: "Descargar canción", sub: "YouTube/Spotify/SoundCloud", action: 1},
                                {icon: "📂", label: "Abrir audio local",  sub: "MP3, M4A, WAV…",         action: -1},
                                {icon: "📁", label: "Abrir proyecto",     sub: "Archivo .llproj",        action: -2},
                            ]
                            Rectangle {
                                width: 210; height: 140
                                color: window.bgCard
                                border.color: cardMouse.containsMouse ? window.lavaRed : window.borderSubtle
                                border.width: 1; radius: 12

                                Behavior on border.color { ColorAnimation { duration: 150 } }

                                Column {
                                    anchors.centerIn: parent
                                    spacing: 10
                                    Text { text: modelData.icon; font.pixelSize: 32; anchors.horizontalCenter: parent.horizontalCenter }
                                    Text { text: modelData.label; font.pixelSize: 13; font.bold: true; color: window.textPrimary; anchors.horizontalCenter: parent.horizontalCenter }
                                    Text { text: modelData.sub; font.pixelSize: 11; color: window.textMuted; anchors.horizontalCenter: parent.horizontalCenter }
                                }

                                MouseArea {
                                    id: cardMouse
                                    anchors.fill: parent; hoverEnabled: true
                                    onClicked: {
                                        if      (modelData.action === 0)  newProjectModal.visible = true
                                        else if (modelData.action === 1)  currentScreen = 1
                                        else if (modelData.action === -1) openMediaDialog.open()
                                        else if (modelData.action === -2) openProjectDialog.open()
                                    }
                                }
                            }
                        }
                    }

                    // Recent projects
                    Column {
                        spacing: 8
                        Layout.alignment: Qt.AlignHCenter
                        visible: projectMgr.recentProjects().length > 0

                        Text { text: "Proyectos recientes"; color: window.textMuted; font.pixelSize: 12; anchors.horizontalCenter: parent.horizontalCenter }
                        Repeater {
                            model: projectMgr.recentProjects().slice(0, 4)
                            Rectangle {
                                width: 500; height: 36
                                color: recentMouse.containsMouse ? window.bgElevated : "transparent"
                                border.color: window.borderSubtle; border.width: 1; radius: 6
                                Text {
                                    anchors.verticalCenter: parent.verticalCenter; anchors.left: parent.left; anchors.leftMargin: 12
                                    text: "📁 " + modelData.split("\\").pop()
                                    color: window.textSecondary; font.pixelSize: 12; elide: Text.ElideLeft; width: parent.width - 24
                                }
                                MouseArea {
                                    id: recentMouse
                                    anchors.fill: parent
                                    hoverEnabled: true
                                    onClicked: {
                                        projectMgr.loadProject(modelData)
                                        currentScreen = 2
                                    }
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
                        Layout.fillWidth: true
                        height: 44
                        color: window.bgCard; border.color: window.borderSubtle; border.width: 1; radius: 10
                        RowLayout {
                            anchors.fill: parent; anchors.margins: 12
                            Text { text: "📂"; font.pixelSize: 16 }
                            TextField {
                                id: outDirField
                                Layout.fillWidth: true
                                text: projectMgr.defaultDownloadsDir()
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
                            implicitWidth: 100; implicitHeight: 44
                            enabled: downloader.isDownloading
                            onClicked: downloader.cancel()
                            contentItem: Text { text: parent.text; color: window.textSecondary; font.pixelSize: 13; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                            background: Rectangle { color: parent.hovered ? window.bgElevated : window.bgCard; border.color: window.borderSubtle; border.width: 1; radius: 10 }
                        }
                    }
                    Button {
                        text: "📝 Cargar letras .lrc manualmente"
                        onClicked: openLyricsDialog.open()
                        contentItem: Text { text: parent.text; color: window.lavaPurple; font.pixelSize: 12; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                        background: Rectangle { color: "transparent" }
                    }
                }
            }

            // ── EDITOR SCREEN ──────────────────────────────────────────────
            Item {
                anchors.fill: parent
                visible: currentScreen === 2

                // Contenedor principal dividido horizontalmente en Izquierda y Derecha
                SplitView {
                    anchors.fill: parent
                    orientation: Qt.Horizontal

                    // LADO IZQUIERDO (Inspector Arriba, Efectos y Biblioteca Abajo)
                    SplitView {
                        SplitView.preferredWidth: 320
                        SplitView.minimumWidth:   260
                        orientation: Qt.Vertical

                        // CUADRANTE 1 (Izquierda Arriba): INSPECTOR
                        Rectangle {
                            SplitView.preferredHeight: parent.height / 2
                            SplitView.minimumHeight: 150
                            color: window.bgDark
                            border.color: window.borderSubtle; border.width: 1

                            ScrollView {
                                anchors.fill: parent
                                clip: true
                                ColumnLayout {
                                    width: parent.width - 16
                                    spacing: 14
                                    anchors.margins: 10

                                    Text {
                                        text: "🔍 Inspector de Propiedades"
                                        font.pixelSize: 13; font.bold: true; color: window.textPrimary
                                    }

                                    ColumnLayout {
                                        visible: window.selectedClipId !== ""
                                        spacing: 12
                                        Layout.fillWidth: true

                                        Rectangle {
                                            Layout.fillWidth: true; height: 32
                                            color: window.bgElevated; radius: 4
                                            Text {
                                                anchors.centerIn: parent
                                                text: "Clip: " + window.selectedClipId.split("/").pop().split("\\").pop()
                                                color: window.lavaOrange; font.bold: true; font.pixelSize: 11
                                            }
                                        }

                                        ColumnLayout {
                                            spacing: 4
                                            Text { text: "Inicio en línea de tiempo (segundos)"; font.pixelSize: 10; color: window.textSecondary }
                                            TextField {
                                                id: inspectorClipStart
                                                text: window.selectedClip.start !== undefined ? window.selectedClip.start.toFixed(2) : "0.0"
                                                color: window.textPrimary
                                                background: Rectangle { color: window.bgCard; border.color: window.borderSubtle; radius: 4 }
                                                font.pixelSize: 11
                                                onAccepted: {
                                                    timeline.moveClipById(window.selectedClipId, parseFloat(text))
                                                }
                                            }
                                        }

                                        ColumnLayout {
                                            spacing: 4
                                            Text { text: "Duración del clip (segundos)"; font.pixelSize: 10; color: window.textSecondary }
                                            TextField {
                                                text: window.selectedClip.duration !== undefined ? window.selectedClip.duration.toFixed(2) : "0.0"
                                                color: window.textPrimary; enabled: false; opacity: 0.6
                                                background: Rectangle { color: window.bgCard; border.color: window.borderSubtle; radius: 4 }
                                                font.pixelSize: 11
                                            }
                                        }

                                        ColumnLayout {
                                            Layout.fillWidth: true
                                            spacing: 6
                                            Text {
                                                text: window.selectedClip.type === "video" ? "Transformar / Bucle" :
                                                      window.selectedClip.type === "audio" ? "Audio" :
                                                      window.selectedClip.type === "lyrics" ? "Lyrics sincronizadas" :
                                                      window.selectedClip.type === "adjustment" ? "Capa de ajuste" : "Propiedades"
                                                color: window.textPrimary; font.bold: true; font.pixelSize: 11
                                            }
                                            Text {
                                                text: window.selectedClip.type === "video" ? "Transformar: posicion, escala, rotacion, opacidad. Bucle: Normal, Boomerang o Live." :
                                                      window.selectedClip.type === "audio" ? "Volumen, offset y archivo fuente del clip de audio." :
                                                      window.selectedClip.type === "lyrics" ? "Versos con timestamps. La sincronizacion se corrige moviendo el bloque completo." :
                                                      window.selectedClip.type === "adjustment" ? "Parametros del efecto aplicado como capa sobre las pistas inferiores." : ""
                                                color: window.textMuted; font.pixelSize: 10; wrapMode: Text.WordWrap; Layout.fillWidth: true
                                            }
                                            ComboBox {
                                                visible: window.selectedClip.type === "video"
                                                Layout.fillWidth: true
                                                model: ["Normal", "Boomerang", "Live"]
                                                onActivated: timeline.setClipProperty(window.selectedClipId, "loopMode", currentText)
                                            }
                                            Button {
                                                visible: window.selectedClip.grouped === true
                                                text: "Desagrupar audio/lyrics"
                                                Layout.fillWidth: true
                                                onClicked: timeline.ungroupClip(window.selectedClipId)
                                            }
                                        }

                                        Button {
                                            text: "🗑️ Eliminar Clip"
                                            Layout.fillWidth: true
                                            implicitHeight: 32
                                            onClicked: {
                                                timeline.deleteClip(window.selectedClipTrack, window.selectedClipId)
                                                window.selectedClipId = ""
                                                window.selectedClipTrack = ""
                                            }
                                            contentItem: Text { text: parent.text; color: "#fff"; font.bold: true; font.pixelSize: 11; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                            background: Rectangle { color: parent.hovered ? "#ff5252" : window.lavaRed; radius: 4 }
                                        }
                                    }

                                    ColumnLayout {
                                        visible: window.selectedClipId === ""
                                        spacing: 12
                                        Layout.fillWidth: true

                                        Text {
                                            text: "Selecciona un clip en la línea de tiempo para ver sus propiedades."
                                            color: window.textMuted
                                            font.pixelSize: 11
                                            wrapMode: Text.WordWrap
                                            Layout.fillWidth: true
                                        }

                                        Rectangle {
                                            Layout.fillWidth: true; height: 1
                                            color: window.borderSubtle
                                        }

                                        Text {
                                            text: "Configuración global de secuencia:"
                                            font.pixelSize: 11; font.bold: true; color: window.textSecondary
                                        }

                                        Text {
                                            text: "📐 Aspecto: " + (comboResolution.currentText.indexOf("Vertical") >= 0 ? "Vertical (9:16)" : "Horizontal (16:9)")
                                            color: window.textSecondary; font.pixelSize: 11
                                        }

                                        Text {
                                            text: "📂 Proyecto en: " + txtProjectLocation.text
                                            color: window.textMuted; font.pixelSize: 10; wrapMode: Text.WordWrap
                                            Layout.fillWidth: true
                                        }
                                    }
                                }
                            }
                        }

                        // CUADRANTE 2 (Izquierda Abajo): EFECTOS Y BIBLIOTECA MULTIMEDIA (Tabulados)
                        Rectangle {
                            id: quadrant2Container
                            SplitView.preferredHeight: parent.height / 2
                            SplitView.minimumHeight: 150
                            color: window.bgDark
                            border.color: window.borderSubtle; border.width: 1

                            property string activeLeftTab: "library" // "library" | "effects"

                            ColumnLayout {
                                anchors.fill: parent
                                spacing: 0

                                RowLayout {
                                    Layout.fillWidth: true
                                    height: 38
                                    spacing: 0

                                    Button {
                                        text: "📁 Biblioteca"
                                        Layout.fillWidth: true
                                        Layout.fillHeight: true
                                        onClicked: quadrant2Container.activeLeftTab = "library"
                                        contentItem: Text { text: parent.text; font.pixelSize: 11; font.bold: quadrant2Container.activeLeftTab === "library"; color: quadrant2Container.activeLeftTab === "library" ? window.lavaRed : window.textSecondary; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                        background: Rectangle { color: quadrant2Container.activeLeftTab === "library" ? window.bgElevated : "transparent"; border.color: quadrant2Container.activeLeftTab === "library" ? window.lavaRed : "transparent"; border.width: 1 }
                                    }
                                    Button {
                                        text: "✨ Efectos"
                                        Layout.fillWidth: true
                                        Layout.fillHeight: true
                                        onClicked: quadrant2Container.activeLeftTab = "effects"
                                        contentItem: Text { text: parent.text; font.pixelSize: 11; font.bold: quadrant2Container.activeLeftTab === "effects"; color: quadrant2Container.activeLeftTab === "effects" ? window.lavaRed : window.textSecondary; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                        background: Rectangle { color: quadrant2Container.activeLeftTab === "effects" ? window.bgElevated : "transparent"; border.color: quadrant2Container.activeLeftTab === "effects" ? window.lavaRed : "transparent"; border.width: 1 }
                                    }
                                }

                                StackLayout {
                                    Layout.fillWidth: true
                                    Layout.fillHeight: true
                                    currentIndex: quadrant2Container.activeLeftTab === "library" ? 0 : 1

                                    // Biblioteca
                                    ColumnLayout {
                                        spacing: 10
                                        anchors.margins: 10

                                        Menu {
                                            id: libraryContextMenu
                                            MenuItem {
                                                text: "Añadir archivo..."
                                                onClicked: openMediaDialog.open()
                                            }
                                            MenuItem {
                                                text: "Añadir canción..."
                                                onClicked: songSearchModal.visible = true
                                            }
                                        }

                                        RowLayout {
                                            Layout.fillWidth: true
                                            Text { text: "📂 Explorador de Biblioteca"; font.pixelSize: 12; font.bold: true; color: window.textPrimary }
                                            Item { Layout.fillWidth: true }
                                            Button {
                                                text: "＋ Importar"
                                                implicitHeight: 24
                                                onClicked: libraryContextMenu.popup()
                                                contentItem: Text { text: parent.text; color: window.lavaPurple; font.bold: true; font.pixelSize: 10; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                                background: Rectangle { color: parent.hovered ? window.bgElevated : "transparent"; border.color: window.borderSubtle; border.width: 1; radius: 4 }
                                            }
                                        }

                                        // Contenedor principal de explorador
                                        Rectangle {
                                            Layout.fillWidth: true
                                            Layout.fillHeight: true
                                            color: window.bgDeep
                                            border.color: window.borderSubtle; border.width: 1; radius: 6

                                            // Doble clic para abrir explorador local e importar
                                            MouseArea {
                                                anchors.fill: parent
                                                acceptedButtons: Qt.LeftButton | Qt.RightButton
                                                onClicked: {
                                                    if (mouse.button === Qt.RightButton) {
                                                        libraryContextMenu.popup()
                                                    }
                                                }
                                                onDoubleClicked: {
                                                    openMediaDialog.open()
                                                }
                                            }

                                            // Vista de cuadrícula/lista de los archivos importados
                                            ColumnLayout {
                                                anchors.fill: parent
                                                anchors.margins: 8
                                                spacing: 8
                                                visible: mediaEngine.mediaPath !== "" || lyricsLoader.isLoaded

                                                Text {
                                                    text: "Archivos en este proyecto:"
                                                    color: window.textMuted; font.pixelSize: 10
                                                }

                                                // Tarjeta Audio
                                                Rectangle {
                                                    Layout.fillWidth: true; height: 50
                                                    color: window.bgCard; border.color: window.borderSubtle; radius: 6
                                                    visible: mediaEngine.mediaPath !== ""
                                                    RowLayout {
                                                        anchors.fill: parent; anchors.margins: 8; spacing: 8
                                                        Text { text: "🎵"; font.pixelSize: 16 }
                                                        ColumnLayout {
                                                            spacing: 2
                                                            Text { text: mediaEngine.mediaPath !== "" ? mediaEngine.mediaPath.split("/").pop().split("\\").pop() : ""; color: window.textPrimary; font.pixelSize: 11; font.bold: true; elide: Text.ElideRight; Layout.fillWidth: true }
                                                            Text { text: "Archivo de Audio/Video"; color: window.textMuted; font.pixelSize: 9 }
                                                        }
                                                    }
                                                }

                                                // Tarjeta Letras
                                                Rectangle {
                                                    Layout.fillWidth: true; height: 50
                                                    color: window.bgCard; border.color: window.borderSubtle; radius: 6
                                                    visible: lyricsLoader.isLoaded
                                                    RowLayout {
                                                        anchors.fill: parent; anchors.margins: 8; spacing: 8
                                                        Text { text: "📝"; font.pixelSize: 16 }
                                                        ColumnLayout {
                                                            spacing: 2
                                                            Text { text: "Letras de canción sincronizadas"; color: window.textPrimary; font.pixelSize: 11; font.bold: true }
                                                            Text { text: lyricsLoader.getAllLines().length + " líneas cargadas"; color: "#4caf50"; font.pixelSize: 9 }
                                                        }
                                                    }
                                                }

                                                Item { Layout.fillHeight: true }
                                            }

                                            // Estado vacío cuando no hay nada importado
                                            ColumnLayout {
                                                anchors.centerIn: parent
                                                spacing: 6
                                                visible: mediaEngine.mediaPath === "" && !lyricsLoader.isLoaded

                                                Text {
                                                    Layout.alignment: Qt.AlignHCenter
                                                    text: "📭"
                                                    font.pixelSize: 32
                                                }
                                                Text {
                                                    Layout.alignment: Qt.AlignHCenter
                                                    text: "Biblioteca vacía"
                                                    color: window.textSecondary; font.pixelSize: 12; font.bold: true
                                                }
                                                Text {
                                                    Layout.alignment: Qt.AlignHCenter
                                                    text: "Doble clic aquí para importar audio/video"
                                                    color: window.textMuted; font.pixelSize: 10
                                                }
                                            }
                                        }
                                    }

                                    // Efectos (Ajustes estilo capas de Adobe Premiere)
                                    ScrollView {
                                        clip: true
                                        ColumnLayout {
                                            width: parent.width - 16
                                            spacing: 12
                                            anchors.margins: 10

                                            Text {
                                                text: "✨ Capas de Ajustes y Efectos"
                                                font.pixelSize: 13; font.bold: true; color: window.textPrimary
                                            }

                                            Text {
                                                text: "Arrastra efectos o crea una capa de ajuste en el timeline para aplicar filtros globales:"
                                                color: window.textSecondary; font.pixelSize: 11; wrapMode: Text.WordWrap; Layout.fillWidth: true
                                            }

                                            ColumnLayout {
                                                spacing: 12
                                                Layout.fillWidth: true

                                                // Listado de efectos estilo Adobe Premiere
                                                Repeater {
                                                    model: [
                                                        { name: "Capa de Ajuste (Brillo/Contraste)", desc: "Controla la exposición y contraste global", icon: "🎞️" },
                                                        { name: "Filtro de Color (Matiz/Saturación)", desc: "Corrige y realza la colorización del video", icon: "🎨" },
                                                        { name: "Efecto Estilo VHS / Glitch", desc: "Añade aberración cromática retro", icon: "📼" },
                                                        { name: "Desfoque Gaussiano (Blur)", desc: "Suaviza el fondo de la previsualización", icon: "💧" }
                                                    ]

                                                    Rectangle {
                                                        Layout.fillWidth: true; height: 58
                                                        color: window.bgCard; border.color: window.borderSubtle; radius: 6

                                                        RowLayout {
                                                            anchors.fill: parent; anchors.margins: 8; spacing: 10
                                                            Text { text: modelData.icon; font.pixelSize: 18 }
                                                            ColumnLayout {
                                                                spacing: 2
                                                                Text { text: modelData.name; color: window.textPrimary; font.bold: true; font.pixelSize: 11 }
                                                                Text { text: modelData.desc; color: window.textMuted; font.pixelSize: 9; elide: Text.ElideRight; Layout.fillWidth: true }
                                                            }
                                                        }
                                                        MouseArea {
                                                            anchors.fill: parent
                                                            hoverEnabled: true
                                                            onClicked: {
                                                                timeline.addAdjustmentClip("V3", modelData.name, mediaEngine.position || 0, 10, {"effect": modelData.name})
                                                                projectMgr.markDirty()
                                                                statusBar.showMsg("Capa de ajuste añadida: " + modelData.name)
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

                    // LADO DERECHO (Previsualización Arriba, Línea del tiempo Abajo)
                    SplitView {
                        SplitView.fillWidth: true
                        orientation: Qt.Vertical

                        // CUADRANTE 3 (Derecha Arriba): PREVISUALIZACIÓN
                        Rectangle {
                            SplitView.preferredHeight: 3 * parent.height / 5
                            SplitView.minimumHeight: 200
                            color: window.bgDeep

                            // Viewport y safe zones
                            Item {
                                id: phoneContainer
                                anchors.centerIn: parent
                                height: Math.min(parent.height - 16, 500)
                                width: height * 9 / 16

                                Rectangle {
                                    anchors.fill: parent; radius: 16; clip: true
                                    color: "#000"
                                    border.color: window.borderSubtle; border.width: 1

                                    Rectangle {
                                        anchors.fill: parent; color: "#080808"
                                        Text {
                                            anchors.centerIn: parent
                                            text: mediaEngine.mediaPath === "" ? "🎬\nArrastra un video\nal timeline" : "▶ Preview"
                                            color: window.textMuted; font.pixelSize: 14
                                            horizontalAlignment: Text.AlignHCenter
                                            wrapMode: Text.WordWrap
                                        }
                                    }

                                    Rectangle {
                                        anchors.fill: parent
                                        anchors.topMargin: parent.height * 0.10
                                        anchors.bottomMargin: parent.height * 0.15
                                        anchors.leftMargin: parent.width * 0.06
                                        anchors.rightMargin: parent.width * 0.06
                                        color: "transparent"
                                        border.color: "#ff3e3e33"; border.width: 1
                                    }

                                    Item {
                                        anchors.fill: parent
                                        visible: window.showGuides

                                        Rectangle { x: parent.width / 3; y: 0; width: 1; height: parent.height; color: "#ffffff1a" }
                                        Rectangle { x: 2 * parent.width / 3; y: 0; width: 1; height: parent.height; color: "#ffffff1a" }
                                        Rectangle { x: 0; y: parent.height / 3; width: parent.width; height: 1; color: "#ffffff1a" }
                                        Rectangle { x: 0; y: 2 * parent.height / 3; width: parent.width; height: 1; color: "#ffffff1a" }
                                        Rectangle { x: 0; y: parent.height / 2; width: parent.width; height: 1; color: window.lavaRed; opacity: 0.25 }
                                        Rectangle { x: parent.width / 2; y: 0; width: 1; height: parent.height; color: window.lavaRed; opacity: 0.25 }
                                    }

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
                                            id: lyricsLine
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

                                    // Selector de calidad de previsualización (top-right)
                                    Row {
                                        anchors.top: parent.top; anchors.right: parent.right
                                        anchors.margins: 6
                                        spacing: 2
                                        property string activeQual: "1/1"
                                        Repeater {
                                            model: ["1/1", "1/2", "1/4"]
                                            Button {
                                                text: modelData
                                                implicitWidth: 32; implicitHeight: 20
                                                contentItem: Text { text: parent.text; font.pixelSize: 8; font.bold: true; color: parent.parent.activeQual === modelData ? "#fff" : window.textMuted; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                                background: Rectangle { color: parent.parent.activeQual === modelData ? window.lavaRed : window.bgCard; radius: 3; border.color: window.borderSubtle; border.width: 1 }
                                                onClicked: {
                                                    parent.parent.activeQual = modelData
                                                    statusBar.showMsg("Calidad de previsualización ajustada a: " + modelData)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // CUADRANTE 4 (Derecha Abajo): LINEA DEL TIEMPO + CONTROLES
                        Rectangle {
                            SplitView.preferredHeight: 2 * parent.height / 5
                            SplitView.minimumHeight: 180
                            color: window.bgDark
                            border.color: window.borderSubtle; border.width: 1

                            ColumnLayout {
                                anchors.fill: parent
                                spacing: 0

                                // Controles de reproducción y transporte
                                Rectangle {
                                    Layout.fillWidth: true; height: 50
                                    color: window.bgDark
                                    border.color: window.borderSubtle; border.width: 1

                                    RowLayout {
                                        anchors.fill: parent
                                        anchors.margins: 6
                                        spacing: 8

                                        // SeekBar
                                        Slider {
                                            id: seekBar
                                            Layout.fillWidth: true
                                            from: 0; to: Math.max(1, mediaEngine.duration)
                                            value: mediaEngine.position
                                            enabled: mediaEngine.duration > 0
                                            onMoved: mediaEngine.seek(value)
                                        }

                                        // Controles
                                        RowLayout {
                                            spacing: 4
                                            Repeater {
                                                model: [
                                                    {text: "⏮", tip: "Inicio"},
                                                    {text: "⏪", tip: "-10s"},
                                                    {text: mediaEngine.isPlaying ? "⏸" : "▶", tip: "Play/Pausa", big: true},
                                                    {text: "⏩", tip: "+10s"},
                                                    {text: "⏭", tip: "Fin"}
                                                ]
                                                Button {
                                                    text: modelData.text
                                                    implicitWidth: modelData.big ? 40 : 30; implicitHeight: 26
                                                    ToolTip.visible: hovered; ToolTip.text: modelData.tip
                                                    onClicked: {
                                                        if      (index === 0) mediaEngine.seek(0)
                                                        else if (index === 1) mediaEngine.seek(Math.max(0, mediaEngine.position - 10))
                                                        else if (index === 2) mediaEngine.isPlaying ? mediaEngine.pause() : mediaEngine.play()
                                                        else if (index === 3) mediaEngine.seek(Math.min(mediaEngine.duration, mediaEngine.position + 10))
                                                        else if (index === 4) mediaEngine.seek(mediaEngine.duration)
                                                    }
                                                }
                                            }
                                        }

                                        Text { text: "🔊"; color: window.textMuted; font.pixelSize: 10 }
                                        Slider {
                                            id: volSlider; from: 0; to: 1; value: mediaEngine.volume
                                            implicitWidth: 60
                                            onMoved: mediaEngine.volume = value
                                        }

                                        Text { text: "🔍"; color: window.textMuted; font.pixelSize: 10 }
                                        Slider {
                                            from: 20; to: 300; value: timelineScale
                                            implicitWidth: 60
                                            onMoved: timelineScale = value
                                        }

                                        CheckBox {
                                            id: chkGuides
                                            text: "Guías"
                                            checked: window.showGuides
                                            onCheckedChanged: window.showGuides = checked
                                            contentItem: Text { text: parent.text; font.pixelSize: 10; color: window.textSecondary; verticalAlignment: Text.AlignVCenter; leftPadding: 16 }
                                        }
                                    }
                                }

                                // Timeline Tracks
                                Rectangle {
                                    Layout.fillWidth: true
                                    Layout.fillHeight: true
                                    color: "#0f0f1a"

                                    ColumnLayout {
                                        anchors.fill: parent
                                        spacing: 0

                                        // Regla de tiempo
                                        RowLayout {
                                            height: 24; Layout.fillWidth: true; spacing: 0
                                            Rectangle { width: 100; height: parent.height; color: "#121220" }
                                            ScrollView {
                                                id: rulerScroll
                                                Layout.fillWidth: true; height: parent.height; clip: true
                                                Row {
                                                    width: Math.max(timelineScroll.contentWidth, 2000)
                                                    height: 24
                                                    Repeater {
                                                        model: Math.ceil(Math.max(mediaEngine.duration, 60) / 5) + 1
                                                        Item {
                                                            width: 5 * timelineScale; height: 24
                                                            Rectangle { width: 1; height: 8; color: window.borderSubtle; anchors.top: parent.top }
                                                            Text {
                                                                text: {
                                                                    let s = index * 5; let m = Math.floor(s/60)
                                                                    return String(m).padStart(2,'0') + ":" + String(s%60).padStart(2,'0')
                                                                }
                                                                anchors.top: parent.top; anchors.topMargin: 8; anchors.left: parent.left; anchors.leftMargin: 2
                                                                color: window.textMuted; font.pixelSize: 8; font.family: "Consolas"
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // Lanes
                                        ScrollView {
                                            id: timelineScroll
                                            Layout.fillWidth: true; Layout.fillHeight: true; clip: true
                                            ColumnLayout {
                                                spacing: 1; width: Math.max(mediaEngine.duration * timelineScale + 200, 2000)

                                                Repeater {
                                                    model: [
                                                        {name: "V3", track: "V3", type: "video"},
                                                        {name: "V2", track: "V2", type: "video"},
                                                        {name: "V1", track: "V1", type: "video"},
                                                        {name: "A1", track: "A1", type: "audio"},
                                                        {name: "A2", track: "A2", type: "audio"},
                                                        {name: "A3", track: "A3", type: "audio"}
                                                    ]
                                                    RowLayout {
                                                        height: 38; spacing: 0

                                                        Rectangle {
                                                            width: 100; height: parent.height; color: "#121220"
                                                            border.color: window.borderSubtle; border.width: 1
                                                            Text { anchors.centerIn: parent; text: modelData.name; color: window.textSecondary; font.pixelSize: 9 }
                                                        }

                                                        Rectangle {
                                                            Layout.fillWidth: true; height: parent.height
                                                            color: "#0f0f1a"
                                                            border.color: window.borderSubtle; border.width: 1
                                                            clip: true

                                                            MouseArea {
                                                                anchors.fill: parent
                                                                acceptedButtons: Qt.LeftButton | Qt.RightButton
                                                                onClicked: {
                                                                    if (mouse.button === Qt.RightButton) {
                                                                        trackContextMenu.popup()
                                                                    }
                                                                }
                                                                onDoubleClicked: openMediaDialog.open()

                                                                Menu {
                                                                    id: trackContextMenu
                                                                    MenuItem {
                                                                        text: modelData.track === "audio" ? "🎵 Añadir Audio / Letras..." : "🎬 Añadir Video..."
                                                                        onClicked: {
                                                                            openMediaDialog.open()
                                                                        }
                                                                    }
                                                                }
                                                            }

                                                            DropArea {
                                                                anchors.fill: parent
                                                                onDropped: {
                                                                    if (drop.hasUrls) {
                                                                        let path = drop.urls[0].toString().replace("file:///","")
                                                                        let startSec = drop.x / timelineScale
                                                                        let clipType = modelData.type === "audio" ? "audio" : (String(path).toLowerCase().endsWith(".lrc") ? "lyrics" : "video")
                                                                        timeline.addMediaClip(modelData.track, clipType, basename(path), path, startSec, 30, 0)
                                                                        if (clipType === "audio") mediaEngine.loadMedia(path)
                                                                        projectMgr.markDirty()
                                                                    }
                                                                }
                                                            }

                                                            Repeater {
                                                                model: timeline.getTrackClips(modelData.track)
                                                                Rectangle {
                                                                    x: modelData.start * timelineScale
                                                                    width: modelData.duration * timelineScale
                                                                    height: parent.height - 4; y: 2; radius: 4
                                                                    color: modelData.type === "lyrics" ? "#40306a" : modelData.type === "audio" ? "#2b1a2d" : modelData.type === "adjustment" ? "#3a3420" : "#152535"
                                                                    border.color: window.selectedClipId === modelData.id ? window.lavaRed : modelData.type === "lyrics" ? "#9d7cff" : modelData.type === "audio" ? "#8d4a70" : modelData.type === "adjustment" ? "#c9a64b" : "#355575"
                                                                    border.width: window.selectedClipId === modelData.id ? 2 : 1
                                                                    Text {
                                                                        anchors.centerIn: parent
                                                                        text: (modelData.grouped ? "🔗 " : "") + (modelData.name || modelData.id)
                                                                        color: modelData.type === "lyrics" ? "#d8cfff" : modelData.type === "audio" ? "#ff9ccc" : "#79aada"; font.pixelSize: 9; elide: Text.ElideRight; width: parent.width - 8
                                                                        horizontalAlignment: Text.AlignHCenter
                                                                    }
                                                                    MouseArea {
                                                                        anchors.fill: parent
                                                                        onClicked: {
                                                                            window.selectedClipId = modelData.id
                                                                            window.selectedClipTrack = modelData.trackId
                                                                        }
                                                                    }
                                                                    DragHandler { onActiveChanged: if (!active) timeline.moveClipById(modelData.id, x / timelineScale) }
                                                                }
                                                            }

                                                            Rectangle {
                                                                x: mediaEngine.position * timelineScale - 1
                                                                width: 2; height: parent.height
                                                                color: window.lavaRed; opacity: 0.9
                                                                Rectangle { width: 6; height: 6; radius: 3; color: window.lavaRed; anchors.horizontalCenter: parent.horizontalCenter; y: -3 }
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
            }
        }

        Rectangle {
            id: toastBox
            visible: window.toastMessage !== ""
            z: 999
            width: Math.min(520, window.width - 48)
            implicitHeight: toastContent.implicitHeight + 24
            radius: 8
            color: window.toastType === "error" ? "#341417" : window.toastType === "success" ? "#12301f" : window.bgElevated
            border.color: window.toastType === "error" ? "#ff5a66" : window.toastType === "success" ? "#4caf50" : window.borderSubtle
            Layout.alignment: Qt.AlignRight
            Layout.rightMargin: 18

            Timer {
                id: toastTimer
                interval: window.toastType === "error" ? 12000 : 4500
                repeat: false
                onTriggered: window.toastMessage = ""
            }

            RowLayout {
                id: toastContent
                anchors.fill: parent
                anchors.margins: 12
                spacing: 10
                Text {
                    text: window.toastType === "error" ? "ERR" : window.toastType === "success" ? "OK" : "INFO"
                    color: "#fff"
                    font.bold: true
                    font.pixelSize: 11
                    Layout.alignment: Qt.AlignTop
                }
                Text {
                    Layout.fillWidth: true
                    text: window.toastMessage
                    color: window.textPrimary
                    font.pixelSize: 11
                    wrapMode: Text.WordWrap
                    maximumLineCount: 8
                    elide: Text.ElideRight
                }
                Button {
                    visible: window.toastType === "error"
                    text: "Copiar error"
                    implicitWidth: 92
                    implicitHeight: 26
                    onClicked: {
                        projectMgr.copyToClipboard(window.toastMessage)
                        statusBar.showMsg("Error copiado al portapapeles")
                    }
                }
                Button {
                    text: "x"
                    implicitWidth: 24
                    implicitHeight: 24
                    onClicked: window.toastMessage = ""
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
