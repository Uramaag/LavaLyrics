cmake_minimum_required(VERSION 3.16)

project(LavaLyrics CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Enable automatic compilation of Qt files
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# Find Qt 6
find_package(Qt6 COMPONENTS Core Quick Qml Widgets REQUIRED)

# Find FFmpeg (search standard locations or local development paths)
find_path(AVCODEC_INCLUDE_DIR NAMES libavcodec/avcodec.h)
find_library(AVCODEC_LIBRARY NAMES avcodec)

find_path(AVFORMAT_INCLUDE_DIR NAMES libavformat/avformat.h)
find_library(AVFORMAT_LIBRARY NAMES avformat)

find_path(AVUTIL_INCLUDE_DIR NAMES libavutil/avutil.h)
find_library(AVUTIL_LIBRARY NAMES avutil)

find_path(SWSCALE_INCLUDE_DIR NAMES libswscale/swscale.h)
find_library(SWSCALE_LIBRARY NAMES swscale)

find_path(SWRESAMPLE_INCLUDE_DIR NAMES libswresample/swresample.h)
find_library(SWRESAMPLE_LIBRARY NAMES swresample)

set(FFMPEG_INCLUDE_DIRS
    ${AVCODEC_INCLUDE_DIR}
    ${AVFORMAT_INCLUDE_DIR}
    ${AVUTIL_INCLUDE_DIR}
    ${SWSCALE_INCLUDE_DIR}
    ${SWRESAMPLE_INCLUDE_DIR}
)

set(FFMPEG_LIBRARIES
    ${AVCODEC_LIBRARY}
    ${AVFORMAT_LIBRARY}
    ${AVUTIL_LIBRARY}
    ${SWSCALE_LIBRARY}
    ${SWRESAMPLE_LIBRARY}
)

# Source files
set(SOURCES
    src/main.cpp
    src/timeline_controller.h
    src/timeline_controller.cpp
    src/media_player_engine.h
    src/media_player_engine.cpp
    src/video_exporter.h
    src/video_exporter.cpp
    src/qml/qml.qrc
)

add_executable(LavaLyrics ${SOURCES})

target_include_directories(LavaLyrics PRIVATE
    ${FFMPEG_INCLUDE_DIRS}
    src
)

target_link_libraries(LavaLyrics PRIVATE
    Qt6::Core
    Qt6::Quick
    Qt6::Qml
    Qt6::Widgets
    ${FFMPEG_LIBRARIES}
)
