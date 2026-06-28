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
    QtObject {
        id: outDirField
        property string text: "C:/Users/" + Qt.platform.os + "/Documents/LavaLyricsProjects/ACALOSPROJECTOS"
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
            if (audioPath !== "") mediaEngine.loadMedia(audioPath)
            if (lyricsPath !== "") {
                if (lyricsPath.endsWith(".lrc"))  lyricsLoader.loadLrc(lyricsPath)
                if (lyricsPath.endsWith(".json")) lyricsLoader.loadJson(lyricsPath)
            }
            currentScreen = 2
        }
        function onDownloadFailed(error) {
            statusBar.showMsg("❌ Error: " + error)
            toastErrorBox.triggerError("Error de Descarga: " + error)
        }
        function onSearchCompleted(results) {
            platformSearchDialog.isLoading = false
            platformSearchDialog.rawResults = results
            platformSearchDialog.search()
        }
        function onSearchFailed(error, details) {
            platformSearchDialog.isLoading = false
            toastErrorBox.triggerError("Buscador: [Código " + error + "] " + details)
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
            toastErrorBox.triggerError(error)
        }
    }

    Connections {
        target: projectMgr
        function onProjectLoaded(data) {
            statusBar.showMsg("📂 Proyecto cargado: " + projectMgr.projectName)
            
            // Re-load tracks if any
            if (data.mediaPath && data.mediaPath !== "") {
                mediaEngine.loadMedia(data.mediaPath)
            }
            if (data.lyricsPath && data.lyricsPath !== "") {
                if (data.lyricsPath.endsWith(".lrc")) lyricsLoader.loadLrc(data.lyricsPath)
                else lyricsLoader.loadJson(data.lyricsPath)
            }
            
            currentScreen = 2 // Go to Editor
        }
        function onErrorOccurred(message) {
            statusBar.showMsg("❌ Error del Proyecto: " + message)
            toastErrorBox.triggerError(message)
        }
    }

    // ── File dialogs ───────────────────────────────────────────────────────
    FileDialog {
        id: loadProjectDialog
        title: "Abrir Proyecto LavaLyrics"
        fileMode: FileDialog.OpenFile
        nameFilters: ["LavaLyrics Projects (*.lavalyrics *.llproj)"]
        onAccepted: {
            projectMgr.loadProject(selectedFile.toString().replace("file:///", ""))
        }
    }

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

    // ── Download progress dialog ───────────────────────────────────────────
    Window {
        id: downloadProgressDialog
        visible: downloader.isDownloading
        width: 440; height: 260
        title: "Descargando música..."
        flags: Qt.Dialog | Qt.WindowTitleHint
        color: window.bgDark
        modality: Qt.ApplicationModal

        ColumnLayout {
            anchors.centerIn: parent
            width: parent.width - 48
            spacing: 20

            Text {
                text: "📥 Descargando audio y letras"
                font.pixelSize: 18; font.bold: true
                color: window.textPrimary
                Layout.alignment: Qt.AlignHCenter
            }
            Text {
                text: downloader.statusMessage
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
                    width: parent.width * downloader.progress / 100
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
                text: downloader.progress + "%"
                font.pixelSize: 24; font.bold: true; color: window.lavaRed
                Layout.alignment: Qt.AlignHCenter
            }
            Button {
                text: "Cancelar"
                Layout.alignment: Qt.AlignHCenter
                onClicked: { downloader.cancel(); downloadProgressDialog.visible = false }
                contentItem: Text { text: parent.text; color: window.textSecondary; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                background: Rectangle { color: parent.hovered ? window.bgElevated : "transparent"; border.color: window.borderSubtle; border.width: 1; radius: 6 }
            }
        }
    }

    // ── Platform Audio & Lyrics Search Dialog Modal ─────────────────────────
    Window {
        id: platformSearchDialog
        visible: false
        width: 800; height: 580
        title: "Buscar Música en Plataformas"
        flags: Qt.Dialog | Qt.WindowTitleHint | Qt.CustomizeWindowHint
        color: window.bgDark
        modality: Qt.ApplicationModal

        property string searchQuery: ""
        property bool filterOnlySynced: false
        property var rawResults: []

        property var filteredResults: []
        property bool isLoading: false

        function performBackendSearch() {
            let q = searchField.text.trim()
            if (q.length > 0) {
                isLoading = true
                downloader.searchOnline(q)
            } else {
                rawResults = []
                search()
            }
        }

        function search() {
            let query = searchField.text.trim().toLowerCase()
            let res = []
            for (let i = 0; i < rawResults.length; i++) {
                let item = rawResults[i]
                if (query === "" || item.title.toLowerCase().indexOf(query) !== -1 || (item.artist && item.artist.toLowerCase().indexOf(query) !== -1)) {
                    if (item.type === "song") {
                        if (filterOnlySynced && !item.hasLyrics) continue
                        res.push(item)
                    } else if (item.tracks) {
                        let childTracks = []
                        for (let j = 0; j < item.tracks.length; j++) {
                            let track = item.tracks[j]
                            if (filterOnlySynced && !track.hasLyrics) continue
                            childTracks.push(track)
                        }
                        if (childTracks.length > 0) {
                            res.push({
                                type: item.type,
                                title: item.title,
                                artist: item.artist,
                                platform: item.platform,
                                isExpanded: item.isExpanded,
                                tracks: childTracks
                            })
                        }
                    }
                }
            }
            filteredResults = res
        }

        Component.onCompleted: search()

        ColumnLayout {
            anchors.fill: parent; anchors.margins: 20; spacing: 14

            Text {
                text: "🔍 Buscador de Música Multiplataforma"
                font.pixelSize: 18; font.bold: true; color: window.textPrimary
            }

            Text {
                text: "Busca canciones en Spotify, SoundCloud, YouTube Music o Musixmatch e impórtalas con un click."
                font.pixelSize: 11; color: window.textSecondary
            }

            // Search input field + options
            RowLayout {
                Layout.fillWidth: true; spacing: 10

                Rectangle {
                    Layout.fillWidth: true; height: 38
                    color: window.bgCard; border.color: searchField.activeFocus ? window.lavaRed : window.borderSubtle
                    border.width: 1; radius: 6

                    RowLayout {
                        anchors.fill: parent; anchors.leftMargin: 8; anchors.rightMargin: 8
                        TextField {
                            id: searchField
                            Layout.fillWidth: true; background: Item {}
                            placeholderText: "Nombre de canción, artista o álbum..."
                            color: window.textPrimary; placeholderTextColor: window.textMuted
                            font.pixelSize: 12
                            onTextChanged: debounceTimer.restart()
                            onAccepted: platformSearchDialog.performBackendSearch()
                        }
                        Button {
                            text: "✕"
                            implicitWidth: 24; implicitHeight: 24
                            onClicked: { searchField.text = ""; platformSearchDialog.performBackendSearch() }
                            contentItem: Text { text: parent.text; color: window.textMuted; font.pixelSize: 10; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                            background: Item {}
                        }
                    }
                }

                Button {
                    text: platformSearchDialog.isLoading ? "⏳" : "Buscar 🚀"
                    implicitWidth: 100; implicitHeight: 38
                    onClicked: platformSearchDialog.performBackendSearch()
                    contentItem: Text { text: parent.text; color: "#fff"; font.bold: true; font.pixelSize: 11; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                    background: Rectangle { color: parent.hovered ? "#ff5252" : window.lavaRed; radius: 6 }
                }
            }

            Timer {
                id: debounceTimer
                interval: 1000
                repeat: false
                onTriggered: platformSearchDialog.performBackendSearch()
            }

            // Filter checkbox row
            RowLayout {
                Layout.fillWidth: true; spacing: 12
                CheckBox {
                    id: syncedLyricsFilter
                    text: "Solo letras sincronizadas"
                    checked: platformSearchDialog.filterOnlySynced
                    onCheckedChanged: {
                        platformSearchDialog.filterOnlySynced = checked
                        platformSearchDialog.search()
                    }
                    contentItem: Text { text: syncedLyricsFilter.text; color: window.textSecondary; font.pixelSize: 11; anchors.left: syncedLyricsFilter.indicator.right; anchors.leftMargin: 6; anchors.verticalCenter: syncedLyricsFilter.indicator.verticalCenter }
                }
            }

            // Results view header
            Rectangle {
                Layout.fillWidth: true; height: 26; color: window.bgDark; border.color: window.borderSubtle; border.width: 1; radius: 4
                RowLayout {
                    anchors.fill: parent; anchors.leftMargin: 12; anchors.rightMargin: 12
                    Text { text: "Nombre / Título"; color: window.textMuted; font.pixelSize: 10; Layout.fillWidth: true }
                    Text { text: "Plataforma"; color: window.textMuted; font.pixelSize: 10; Layout.preferredWidth: 110 }
                    Text { text: "Letras"; color: window.textMuted; font.pixelSize: 10; Layout.preferredWidth: 80; horizontalAlignment: Text.AlignHCenter }
                    Text { text: "Estado"; color: window.textMuted; font.pixelSize: 10; Layout.preferredWidth: 100; horizontalAlignment: Text.AlignHCenter }
                    Text { text: "Acción"; color: window.textMuted; font.pixelSize: 10; Layout.preferredWidth: 90; horizontalAlignment: Text.AlignRight }
                }
            }

            // Results List
            ScrollView {
                Layout.fillWidth: true; Layout.fillHeight: true; clip: true
                ListView {
                    id: searchListView
                    anchors.fill: parent
                    model: platformSearchDialog.filteredResults
                    spacing: 4

                    delegate: ColumnLayout {
                        width: searchListView.width
                        spacing: 2

                        // Main row
                        Rectangle {
                            Layout.fillWidth: true; Layout.preferredHeight: 42
                            color: mouseArea.containsMouse ? window.bgElevated : window.bgCard
                            radius: 6; border.color: window.borderSubtle; border.width: 1

                            MouseArea {
                                id: mouseArea
                                anchors.fill: parent; hoverEnabled: true
                                onClicked: {
                                    if (modelData.type !== "song") {
                                        modelData.isExpanded = !modelData.isExpanded
                                        platformSearchDialog.search() // trigger redraw
                                    }
                                }
                                onDoubleClicked: {
                                    if (modelData.type === "song") {
                                        downloadProgressDialog.visible = true
                                        let outDir = projectMgr.workspacePath + "\\media"
                                        downloader.downloadFromUrl(modelData.url, outDir)
                                    }
                                }
                            }

                            RowLayout {
                                anchors.fill: parent; anchors.leftMargin: 12; anchors.rightMargin: 12

                                // Expand button / Title
                                RowLayout {
                                    Layout.fillWidth: true; spacing: 8
                                    Text {
                                        text: modelData.type === "album" ? "💿" : (modelData.type === "artist" ? "👤" : "🎵")
                                        font.pixelSize: 12
                                    }
                                    ColumnLayout {
                                        spacing: 2
                                        Text {
                                            text: modelData.title
                                            color: window.textPrimary; font.bold: true; font.pixelSize: 11
                                        }
                                        Text {
                                            text: modelData.artist ? modelData.artist : (modelData.type === "album" ? "Álbum" : "Artista")
                                            color: window.textMuted; font.pixelSize: 9
                                            visible: modelData.artist || modelData.type !== "song"
                                        }
                                    }
                                    
                                    Button {
                                        visible: modelData.type === "album" || modelData.type === "artist"
                                        text: modelData.isExpanded ? "▲ Ocultar canciones" : "▼ Ver canciones"
                                        implicitHeight: 20
                                        contentItem: Text { text: parent.text; color: window.lavaPurple; font.pixelSize: 9; font.bold: true }
                                        background: Item {}
                                        onClicked: {
                                            modelData.isExpanded = !modelData.isExpanded
                                            // Force trigger model update
                                            platformSearchDialog.search()
                                        }
                                    }
                                }

                                // Platform
                                Text {
                                    text: modelData.platform
                                    color: window.textSecondary; font.pixelSize: 10
                                    Layout.preferredWidth: 110
                                }

                                // Has lyrics
                                Text {
                                    text: modelData.type === "song" ? (modelData.hasLyrics ? "✅ Sincronizadas" : "❌ No") : "-"
                                    color: modelData.hasLyrics ? "#4caf50" : window.textMuted; font.pixelSize: 10
                                    Layout.preferredWidth: 80; horizontalAlignment: Text.AlignHCenter
                                }

                                // State
                                Text {
                                    text: modelData.type === "song" ? (modelData.isDownloaded ? "📥 Guardada" : "☁ En Nube") : "-"
                                    color: modelData.isDownloaded ? "#81c784" : window.textMuted; font.pixelSize: 10
                                    Layout.preferredWidth: 100; horizontalAlignment: Text.AlignHCenter
                                }

                                // Download Action Button
                                Button {
                                    visible: modelData.type === "song"
                                    text: modelData.isDownloaded ? "Importar" : "Descargar"
                                    Layout.preferredWidth: 90; implicitHeight: 26
                                    onClicked: {
                                        if (modelData.isDownloaded) {
                                            // Simulate direct load since it is pre-downloaded
                                            statusBar.showMsg("Importando: " + modelData.title)
                                            downloader.downloadCompleted("C:/LavaLyricsProjects/samples/" + modelData.title + ".mp3", "")
                                        } else {
                                            downloader.downloadSpotify(modelData.url, outDirField.text)
                                        }
                                        platformSearchDialog.close()
                                    }
                                    contentItem: Text { text: parent.text; color: "#fff"; font.bold: true; font.pixelSize: 10; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                    background: Rectangle { color: parent.hovered ? "#ff5252" : window.lavaRed; radius: 4 }
                                }
                            }
                        }

                        // Child tracks list for artist/album
                        ColumnLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: 24
                            visible: (modelData.type === "album" || modelData.type === "artist") && modelData.isExpanded
                            spacing: 2

                            Repeater {
                                model: modelData.tracks
                                Rectangle {
                                    Layout.fillWidth: true; height: 36
                                    color: window.bgDark; radius: 4; border.color: window.borderSubtle; border.width: 1

                                    RowLayout {
                                        anchors.fill: parent; anchors.leftMargin: 8; anchors.rightMargin: 8
                                        Text {
                                            text: "↳  " + modelData.title
                                            color: window.textSecondary; font.pixelSize: 10; Layout.fillWidth: true
                                        }
                                        Text {
                                            text: modelData.hasLyrics ? "✅ Sincronizadas" : "❌ No"
                                            color: modelData.hasLyrics ? "#4caf50" : window.textMuted; font.pixelSize: 9
                                            Layout.preferredWidth: 80; horizontalAlignment: Text.AlignHCenter
                                        }
                                        Text {
                                            text: modelData.isDownloaded ? "📥 Guardada" : "☁ En Nube"
                                            color: modelData.isDownloaded ? "#81c784" : window.textMuted; font.pixelSize: 9
                                            Layout.preferredWidth: 100; horizontalAlignment: Text.AlignHCenter
                                        }
                                        Button {
                                            text: modelData.isDownloaded ? "Importar" : "Descargar"
                                            Layout.preferredWidth: 80; implicitHeight: 22
                                            onClicked: {
                                                if (modelData.isDownloaded) {
                                                    downloader.downloadCompleted("C:/LavaLyricsProjects/samples/" + modelData.title + ".mp3", "")
                                                } else {
                                                    downloader.downloadSpotify(modelData.url, outDirField.text)
                                                }
                                                platformSearchDialog.close()
                                            }
                                            contentItem: Text { text: parent.text; color: "#fff"; font.bold: true; font.pixelSize: 9; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                            background: Rectangle { color: parent.hovered ? "#ff5252" : window.lavaRed; radius: 4 }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Close button
            Button {
                text: "Cerrar"
                Layout.alignment: Qt.AlignRight; implicitWidth: 100; implicitHeight: 34
                onClicked: platformSearchDialog.close()
                contentItem: Text { text: parent.text; color: window.textSecondary; font.pixelSize: 11; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                background: Rectangle { color: parent.hovered ? window.bgElevated : "transparent"; border.color: window.borderSubtle; border.width: 1; radius: 6 }
            }
        }

        function open() {
            searchField.text = ""
            search()
            visible = true
        }

        function close() {
            visible = false
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

                    // Main Action Area (Nuevo / Abrir Proyecto Cards)
                    RowLayout {
                        Layout.alignment: Qt.AlignHCenter
                        spacing: 24

                        // Nuevo Proyecto Card
                        Rectangle {
                            width: 260; height: 150
                            color: window.bgCard
                            border.color: newProjectMouse.containsMouse ? window.lavaRed : window.borderSubtle
                            border.width: 1; radius: 12
                            
                            // Glow effect
                            Rectangle {
                                anchors.fill: parent; radius: 12; z: -1
                                color: "transparent"; border.color: window.lavaRed; border.width: 2
                                opacity: newProjectMouse.containsMouse ? 0.3 : 0
                            }

                            MouseArea {
                                id: newProjectMouse
                                anchors.fill: parent
                                hoverEnabled: true
                                onClicked: { createProjectDialog.visible = true; createProjectDialog.reset() }
                            }
                            Column {
                                anchors.centerIn: parent
                                spacing: 10
                                Text {
                                    text: "➕"
                                    font.pixelSize: 32
                                    anchors.horizontalCenter: parent.horizontalCenter
                                }
                                Text {
                                    text: "NUEVO PROYECTO"
                                    font.pixelSize: 14
                                    font.bold: true
                                    color: window.textPrimary
                                    anchors.horizontalCenter: parent.horizontalCenter
                                }
                                Text {
                                    text: "Comienza una nueva creación"
                                    font.pixelSize: 10
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

                        // Abrir Proyecto Card
                        Rectangle {
                            width: 260; height: 150
                            color: window.bgCard
                            border.color: openProjectMouse.containsMouse ? window.lavaPurple : window.borderSubtle
                            border.width: 1; radius: 12
                            
                            // Glow effect
                            Rectangle {
                                anchors.fill: parent; radius: 12; z: -1
                                color: "transparent"; border.color: window.lavaPurple; border.width: 2
                                opacity: openProjectMouse.containsMouse ? 0.3 : 0
                            }

                            Column {
                                anchors.centerIn: parent
                                spacing: 10
                                Text {
                                    text: "📂"
                                    font.pixelSize: 32
                                    anchors.horizontalCenter: parent.horizontalCenter
                                }
                                Text {
                                    text: "ABRIR PROYECTO"
                                    font.pixelSize: 14
                                    font.bold: true
                                    color: window.textPrimary
                                    anchors.horizontalCenter: parent.horizontalCenter
                                }
                                Text {
                                    text: "Carga un proyecto existente (.lavalyrics)"
                                    font.pixelSize: 10
                                    color: window.textMuted
                                    anchors.horizontalCenter: parent.horizontalCenter
                                }
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

            // ── EDITOR SCREEN ──────────────────────────────────────────────
            Item {
                anchors.fill: parent
                visible: currentScreen === 2

                SplitView {
                    anchors.fill: parent
                    orientation: Qt.Horizontal

                    // ── Left sidebar (Dividido Verticalmente: Inspector arriba, Pestañas abajo) ──
                    SplitView {
                        SplitView.preferredWidth: 300
                        SplitView.minimumWidth: 200
                        orientation: Qt.Vertical

                        // [Cuadrante Izquierda Arriba] Inspector
                        Rectangle {
                            SplitView.preferredHeight: parent.height * 0.45
                            SplitView.minimumHeight: 180
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

                        // [Cuadrante Izquierda Abajo] Pestañas Multimedia / Efectos
                        Rectangle {
                            id: leftBottomTabs
                            SplitView.preferredHeight: parent.height * 0.55
                            SplitView.minimumHeight: 200
                            color: window.bgDark
                            border.color: window.borderSubtle; border.width: 1

                            property int activeTab: 0 // 0 = Elementos, 1 = Efectos

                            ColumnLayout {
                                anchors.fill: parent; spacing: 0

                                // Tab Header Buttons
                                RowLayout {
                                    Layout.fillWidth: true
                                    spacing: 0
                                    
                                    Button {
                                        text: "📂 MULTIMEDIA"
                                        Layout.fillWidth: true; implicitHeight: 32
                                        onClicked: leftBottomTabs.activeTab = 0
                                        contentItem: Text { text: parent.text; color: leftBottomTabs.activeTab === 0 ? window.lavaRed : window.textSecondary; font.bold: true; font.pixelSize: 10; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                        background: Rectangle { color: leftBottomTabs.activeTab === 0 ? window.bgElevated : "transparent"; border.color: window.borderSubtle; border.width: 1 }
                                    }
                                    Button {
                                        text: "⚡ EFECTOS"
                                        Layout.fillWidth: true; implicitHeight: 32
                                        onClicked: leftBottomTabs.activeTab = 1
                                        contentItem: Text { text: parent.text; color: leftBottomTabs.activeTab === 1 ? window.lavaRed : window.textSecondary; font.bold: true; font.pixelSize: 10; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                        background: Rectangle { color: leftBottomTabs.activeTab === 1 ? window.bgElevated : "transparent"; border.color: window.borderSubtle; border.width: 1 }
                                    }
                                }

                                // Tab content container
                                StackLayout {
                                    Layout.fillWidth: true; Layout.fillHeight: true
                                    currentIndex: leftBottomTabs.activeTab

                                    // Tab 0: Multimedia Library
                                    Item {
                                        Layout.fillWidth: true; Layout.fillHeight: true

                                        Rectangle {
                                            anchors.fill: parent; anchors.margins: 8
                                            color: window.bgCard; border.color: placeholderMouse.containsMouse ? window.lavaRed : window.borderSubtle
                                            border.width: 1; radius: 8

                                            ColumnLayout {
                                                anchors.centerIn: parent; spacing: 10
                                                width: parent.width * 0.9

                                                Text {
                                                    text: "📁"
                                                    font.pixelSize: 32; Layout.alignment: Qt.AlignHCenter
                                                }
                                                Text {
                                                    text: "Doble click para importar medios\n(abre explorador de Windows)"
                                                    color: window.textPrimary; font.pixelSize: 11; font.bold: true
                                                    horizontalAlignment: Text.AlignHCenter; Layout.fillWidth: true; wrapMode: Text.WordWrap
                                                }
                                                Text {
                                                    text: "Click derecho para importar audio\n(Buscar en Spotify, Soundcloud, etc.)"
                                                    color: window.textMuted; font.pixelSize: 10
                                                    horizontalAlignment: Text.AlignHCenter; Layout.fillWidth: true; wrapMode: Text.WordWrap
                                                }
                                            }

                                            MouseArea {
                                                id: placeholderMouse
                                                anchors.fill: parent; hoverEnabled: true
                                                acceptedButtons: Qt.LeftButton | Qt.RightButton
                                                onDoubleClicked: {
                                                    if (mouse.button === Qt.LeftButton) {
                                                        openMediaDialog.open()
                                                    }
                                                }
                                                onClicked: {
                                                    if (mouse.button === Qt.RightButton) {
                                                        platformSearchDialog.open()
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Tab 1: Effects List
                                    ColumnLayout {
                                        anchors.fill: parent; anchors.margins: 12; spacing: 8
                                        Text { text: "Efectos Visuales"; font.bold: true; color: window.textPrimary; font.pixelSize: 12 }
                                        Text { text: "• Efecto Zoom Dinámico (Activo)"; color: window.textSecondary; font.pixelSize: 11 }
                                        Text { text: "• Bordes de Safe Zone (Red)"; color: window.textSecondary; font.pixelSize: 11 }
                                        Text { text: "• Animación de Letras (Rebote)"; color: window.textSecondary; font.pixelSize: 11 }
                                        Item { Layout.fillHeight: true }
                                    }
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

    // ── Global Error Toast ─────────────────────────────────────────────────
    Rectangle {
        id: toastErrorBox
        visible: false
        width: 480; height: 75; radius: 8
        color: "#1e0f0f"; border.color: "#ff3e3e"; border.width: 1.5
        anchors.bottom: parent.bottom; anchors.bottomMargin: 30
        anchors.horizontalCenter: parent.horizontalCenter
        z: 99999

        property string errorDetails: ""

        RowLayout {
            anchors.fill: parent; anchors.margins: 12; spacing: 12

            Text {
                text: "⚠️"
                font.pixelSize: 22; Layout.alignment: Qt.AlignVCenter
            }

            ColumnLayout {
                Layout.fillWidth: true; spacing: 2; Layout.alignment: Qt.AlignVCenter
                Text {
                    text: "¡Ocurrió un error en el backend!"
                    color: "#ff8b8b"; font.pixelSize: 11; font.bold: true
                }
                Text {
                    text: toastErrorBox.errorDetails
                    color: "#ffbaba"; font.pixelSize: 10
                    elide: Text.ElideRight; Layout.fillWidth: true
                }
            }

            Button {
                text: "Copiar"
                implicitWidth: 70; implicitHeight: 28
                onClicked: {
                    searchField.text = toastErrorBox.errorDetails // Use a dummy helper to set/get or clipboard
                    // Standard way in Qt QML to copy to clipboard is using an invisible TextInput
                    clipboardHelper.text = toastErrorBox.errorDetails
                    clipboardHelper.selectAll()
                    clipboardHelper.copy()
                    statusBar.showMsg("¡Copiado al portapapeles!")
                }
                contentItem: Text { text: parent.text; color: "#fff"; font.pixelSize: 10; font.bold: true; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                background: Rectangle { color: parent.hovered ? "#4a1111" : "#340a0a"; border.color: "#ff3e3e"; border.width: 1; radius: 4 }
            }

            Button {
                text: "✕"
                implicitWidth: 24; implicitHeight: 28
                onClicked: toastErrorBox.visible = false
                contentItem: Text { text: parent.text; color: "#ff8b8b"; font.pixelSize: 11; font.bold: true; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                background: Item {}
            }
        }

        TextInput {
            id: clipboardHelper
            visible: false
        }

        function triggerError(msg) {
            errorDetails = msg
            visible = true
            toastTimer.restart()
        }

        Timer {
            id: toastTimer
            interval: 8000
            onTriggered: toastErrorBox.visible = false
        }
    }
}
