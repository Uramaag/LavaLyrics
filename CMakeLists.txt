cmake_minimum_required(VERSION 3.16)

project(LavaLyrics CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Qt auto-tools
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# ── Find Qt6 ──────────────────────────────────────────────────────────────────
# Search common aqtinstall/official installer paths
list(APPEND CMAKE_PREFIX_PATH
    "C:/Qt/6.7.3/mingw_64"
    "C:/Qt/6.7.2/mingw_64"
    "C:/Qt/6.7.0/mingw_64"
    "C:/Qt/6.6.3/mingw_64"
    "C:/Qt/6.6.2/mingw_64"
    "C:/Qt/6.5.3/mingw_64"
    "$ENV{USERPROFILE}/Qt/6.7.3/mingw_64"
    "$ENV{USERPROFILE}/Qt/6.7.2/mingw_64"
    "$ENV{Qt6_DIR}"
    "$ENV{Qt_DIR}"
)

find_package(Qt6 COMPONENTS Core Quick Qml Widgets Multimedia REQUIRED)
message(STATUS "Found Qt6: ${Qt6_VERSION} at ${Qt6_DIR}")

# ── FFmpeg (optional — enables real frame decode) ─────────────────────────────
option(LAVA_USE_FFMPEG "Enable real FFmpeg video decode" OFF)

if(LAVA_USE_FFMPEG)
    find_path(AVCODEC_INCLUDE_DIR   NAMES libavcodec/avcodec.h)
    find_path(AVFORMAT_INCLUDE_DIR  NAMES libavformat/avformat.h)
    find_path(AVUTIL_INCLUDE_DIR    NAMES libavutil/avutil.h)
    find_path(SWSCALE_INCLUDE_DIR   NAMES libswscale/swscale.h)

    find_library(AVCODEC_LIBRARY    NAMES avcodec)
    find_library(AVFORMAT_LIBRARY   NAMES avformat)
    find_library(AVUTIL_LIBRARY     NAMES avutil)
    find_library(SWSCALE_LIBRARY    NAMES swscale)

    if(AVCODEC_INCLUDE_DIR AND AVCODEC_LIBRARY)
        set(FFMPEG_FOUND TRUE)
        message(STATUS "FFmpeg found — enabling real decode")
        add_compile_definitions(FFMPEG_AVAILABLE)
    else()
        message(WARNING "FFmpeg NOT found — using simulation fallback")
    endif()
endif()

# ── Source files ──────────────────────────────────────────────────────────────
set(SOURCES
    src/main.cpp
    src/timeline_controller.h
    src/timeline_controller.cpp
    src/media_player_engine.h
    src/media_player_engine.cpp
    src/video_exporter.h
    src/video_exporter.cpp
    src/lyrics_loader.h
    src/lyrics_loader.cpp
    src/project_manager.h
    src/project_manager.cpp
    src/downloader_bridge.h
    src/downloader_bridge.cpp
    src/qml/qml.qrc
)

add_executable(LavaLyrics WIN32 ${SOURCES})

target_include_directories(LavaLyrics PRIVATE src)

target_link_libraries(LavaLyrics PRIVATE
    Qt6::Core
    Qt6::Quick
    Qt6::Qml
    Qt6::Widgets
    Qt6::Multimedia
)

if(LAVA_USE_FFMPEG AND FFMPEG_FOUND)
    target_include_directories(LavaLyrics PRIVATE
        ${AVCODEC_INCLUDE_DIR}
        ${AVFORMAT_INCLUDE_DIR}
        ${AVUTIL_INCLUDE_DIR}
        ${SWSCALE_INCLUDE_DIR}
    )
    target_link_libraries(LavaLyrics PRIVATE
        ${AVCODEC_LIBRARY}
        ${AVFORMAT_LIBRARY}
        ${AVUTIL_LIBRARY}
        ${SWSCALE_LIBRARY}
    )
endif()

# ── Post-build: copy to dist/ ─────────────────────────────────────────────────
set(DIST_DIR "${CMAKE_SOURCE_DIR}/dist")
add_custom_command(TARGET LavaLyrics POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory "${DIST_DIR}"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "$<TARGET_FILE:LavaLyrics>" "${DIST_DIR}/LavaLyrics.exe"
    COMMENT "Copying LavaLyrics.exe to dist/"
)
