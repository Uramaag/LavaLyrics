/****************************************************************************
** Meta object code from reading C++ file 'media_player_engine.h'
**
** Created by: The Qt Meta Object Compiler version 68 (Qt 6.7.2)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../src/media_player_engine.h"
#include <QtCore/qmetatype.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'media_player_engine.h' doesn't include <QObject>."
#elif Q_MOC_OUTPUT_REVISION != 68
#error "This file was generated using the moc from 6.7.2. It"
#error "cannot be used with the include files from this version of Qt."
#error "(The moc has changed too much.)"
#endif

#ifndef Q_CONSTINIT
#define Q_CONSTINIT
#endif

QT_WARNING_PUSH
QT_WARNING_DISABLE_DEPRECATED
QT_WARNING_DISABLE_GCC("-Wuseless-cast")
namespace {

#ifdef QT_MOC_HAS_STRINGDATA
struct qt_meta_stringdata_CLASSMediaPlayerEngineENDCLASS_t {};
constexpr auto qt_meta_stringdata_CLASSMediaPlayerEngineENDCLASS = QtMocHelpers::stringData(
    "MediaPlayerEngine",
    "mediaPathChanged",
    "",
    "durationChanged",
    "positionChanged",
    "isPlayingChanged",
    "volumeChanged",
    "frameReady",
    "frame",
    "mediaLoaded",
    "success",
    "path",
    "errorOccurred",
    "msg",
    "onPlaybackTick",
    "loadMedia",
    "play",
    "pause",
    "stop",
    "seek",
    "seconds",
    "getFrameAt",
    "formatTime",
    "mediaPath",
    "duration",
    "position",
    "isPlaying",
    "volume"
);
#else  // !QT_MOC_HAS_STRINGDATA
#error "qtmochelpers.h not found or too old."
#endif // !QT_MOC_HAS_STRINGDATA
} // unnamed namespace

Q_CONSTINIT static const uint qt_meta_data_CLASSMediaPlayerEngineENDCLASS[] = {

 // content:
      12,       // revision
       0,       // classname
       0,    0, // classinfo
      16,   14, // methods
       5,  142, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       8,       // signalCount

 // signals: name, argc, parameters, tag, flags, initial metatype offsets
       1,    0,  110,    2, 0x06,    6 /* Public */,
       3,    0,  111,    2, 0x06,    7 /* Public */,
       4,    0,  112,    2, 0x06,    8 /* Public */,
       5,    0,  113,    2, 0x06,    9 /* Public */,
       6,    0,  114,    2, 0x06,   10 /* Public */,
       7,    1,  115,    2, 0x06,   11 /* Public */,
       9,    2,  118,    2, 0x06,   13 /* Public */,
      12,    1,  123,    2, 0x06,   16 /* Public */,

 // slots: name, argc, parameters, tag, flags, initial metatype offsets
      14,    0,  126,    2, 0x08,   18 /* Private */,

 // methods: name, argc, parameters, tag, flags, initial metatype offsets
      15,    1,  127,    2, 0x02,   19 /* Public */,
      16,    0,  130,    2, 0x02,   21 /* Public */,
      17,    0,  131,    2, 0x02,   22 /* Public */,
      18,    0,  132,    2, 0x02,   23 /* Public */,
      19,    1,  133,    2, 0x02,   24 /* Public */,
      21,    1,  136,    2, 0x02,   26 /* Public */,
      22,    1,  139,    2, 0x102,   28 /* Public | MethodIsConst  */,

 // signals: parameters
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void, QMetaType::QImage,    8,
    QMetaType::Void, QMetaType::Bool, QMetaType::QString,   10,   11,
    QMetaType::Void, QMetaType::QString,   13,

 // slots: parameters
    QMetaType::Void,

 // methods: parameters
    QMetaType::Bool, QMetaType::QString,   11,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void, QMetaType::Double,   20,
    QMetaType::QImage, QMetaType::Double,   20,
    QMetaType::QString, QMetaType::Double,   20,

 // properties: name, type, flags
      23, QMetaType::QString, 0x00015103, uint(0), 0,
      24, QMetaType::Double, 0x00015001, uint(1), 0,
      25, QMetaType::Double, 0x00015001, uint(2), 0,
      26, QMetaType::Bool, 0x00015103, uint(3), 0,
      27, QMetaType::Double, 0x00015103, uint(4), 0,

       0        // eod
};

Q_CONSTINIT const QMetaObject MediaPlayerEngine::staticMetaObject = { {
    QMetaObject::SuperData::link<QObject::staticMetaObject>(),
    qt_meta_stringdata_CLASSMediaPlayerEngineENDCLASS.offsetsAndSizes,
    qt_meta_data_CLASSMediaPlayerEngineENDCLASS,
    qt_static_metacall,
    nullptr,
    qt_incomplete_metaTypeArray<qt_meta_stringdata_CLASSMediaPlayerEngineENDCLASS_t,
        // property 'mediaPath'
        QtPrivate::TypeAndForceComplete<QString, std::true_type>,
        // property 'duration'
        QtPrivate::TypeAndForceComplete<double, std::true_type>,
        // property 'position'
        QtPrivate::TypeAndForceComplete<double, std::true_type>,
        // property 'isPlaying'
        QtPrivate::TypeAndForceComplete<bool, std::true_type>,
        // property 'volume'
        QtPrivate::TypeAndForceComplete<double, std::true_type>,
        // Q_OBJECT / Q_GADGET
        QtPrivate::TypeAndForceComplete<MediaPlayerEngine, std::true_type>,
        // method 'mediaPathChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'durationChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'positionChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'isPlayingChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'volumeChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'frameReady'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QImage &, std::false_type>,
        // method 'mediaLoaded'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<bool, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        // method 'errorOccurred'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        // method 'onPlaybackTick'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'loadMedia'
        QtPrivate::TypeAndForceComplete<bool, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        // method 'play'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'pause'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'stop'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'seek'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<double, std::false_type>,
        // method 'getFrameAt'
        QtPrivate::TypeAndForceComplete<QImage, std::false_type>,
        QtPrivate::TypeAndForceComplete<double, std::false_type>,
        // method 'formatTime'
        QtPrivate::TypeAndForceComplete<QString, std::false_type>,
        QtPrivate::TypeAndForceComplete<double, std::false_type>
    >,
    nullptr
} };

void MediaPlayerEngine::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    if (_c == QMetaObject::InvokeMetaMethod) {
        auto *_t = static_cast<MediaPlayerEngine *>(_o);
        (void)_t;
        switch (_id) {
        case 0: _t->mediaPathChanged(); break;
        case 1: _t->durationChanged(); break;
        case 2: _t->positionChanged(); break;
        case 3: _t->isPlayingChanged(); break;
        case 4: _t->volumeChanged(); break;
        case 5: _t->frameReady((*reinterpret_cast< std::add_pointer_t<QImage>>(_a[1]))); break;
        case 6: _t->mediaLoaded((*reinterpret_cast< std::add_pointer_t<bool>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<QString>>(_a[2]))); break;
        case 7: _t->errorOccurred((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1]))); break;
        case 8: _t->onPlaybackTick(); break;
        case 9: { bool _r = _t->loadMedia((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1])));
            if (_a[0]) *reinterpret_cast< bool*>(_a[0]) = std::move(_r); }  break;
        case 10: _t->play(); break;
        case 11: _t->pause(); break;
        case 12: _t->stop(); break;
        case 13: _t->seek((*reinterpret_cast< std::add_pointer_t<double>>(_a[1]))); break;
        case 14: { QImage _r = _t->getFrameAt((*reinterpret_cast< std::add_pointer_t<double>>(_a[1])));
            if (_a[0]) *reinterpret_cast< QImage*>(_a[0]) = std::move(_r); }  break;
        case 15: { QString _r = _t->formatTime((*reinterpret_cast< std::add_pointer_t<double>>(_a[1])));
            if (_a[0]) *reinterpret_cast< QString*>(_a[0]) = std::move(_r); }  break;
        default: ;
        }
    } else if (_c == QMetaObject::IndexOfMethod) {
        int *result = reinterpret_cast<int *>(_a[0]);
        {
            using _t = void (MediaPlayerEngine::*)();
            if (_t _q_method = &MediaPlayerEngine::mediaPathChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 0;
                return;
            }
        }
        {
            using _t = void (MediaPlayerEngine::*)();
            if (_t _q_method = &MediaPlayerEngine::durationChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 1;
                return;
            }
        }
        {
            using _t = void (MediaPlayerEngine::*)();
            if (_t _q_method = &MediaPlayerEngine::positionChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 2;
                return;
            }
        }
        {
            using _t = void (MediaPlayerEngine::*)();
            if (_t _q_method = &MediaPlayerEngine::isPlayingChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 3;
                return;
            }
        }
        {
            using _t = void (MediaPlayerEngine::*)();
            if (_t _q_method = &MediaPlayerEngine::volumeChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 4;
                return;
            }
        }
        {
            using _t = void (MediaPlayerEngine::*)(const QImage & );
            if (_t _q_method = &MediaPlayerEngine::frameReady; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 5;
                return;
            }
        }
        {
            using _t = void (MediaPlayerEngine::*)(bool , const QString & );
            if (_t _q_method = &MediaPlayerEngine::mediaLoaded; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 6;
                return;
            }
        }
        {
            using _t = void (MediaPlayerEngine::*)(const QString & );
            if (_t _q_method = &MediaPlayerEngine::errorOccurred; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 7;
                return;
            }
        }
    } else if (_c == QMetaObject::ReadProperty) {
        auto *_t = static_cast<MediaPlayerEngine *>(_o);
        (void)_t;
        void *_v = _a[0];
        switch (_id) {
        case 0: *reinterpret_cast< QString*>(_v) = _t->mediaPath(); break;
        case 1: *reinterpret_cast< double*>(_v) = _t->duration(); break;
        case 2: *reinterpret_cast< double*>(_v) = _t->position(); break;
        case 3: *reinterpret_cast< bool*>(_v) = _t->isPlaying(); break;
        case 4: *reinterpret_cast< double*>(_v) = _t->volume(); break;
        default: break;
        }
    } else if (_c == QMetaObject::WriteProperty) {
        auto *_t = static_cast<MediaPlayerEngine *>(_o);
        (void)_t;
        void *_v = _a[0];
        switch (_id) {
        case 0: _t->setMediaPath(*reinterpret_cast< QString*>(_v)); break;
        case 3: _t->setIsPlaying(*reinterpret_cast< bool*>(_v)); break;
        case 4: _t->setVolume(*reinterpret_cast< double*>(_v)); break;
        default: break;
        }
    } else if (_c == QMetaObject::ResetProperty) {
    } else if (_c == QMetaObject::BindableProperty) {
    }
}

const QMetaObject *MediaPlayerEngine::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *MediaPlayerEngine::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_meta_stringdata_CLASSMediaPlayerEngineENDCLASS.stringdata0))
        return static_cast<void*>(this);
    return QObject::qt_metacast(_clname);
}

int MediaPlayerEngine::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QObject::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 16)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 16;
    } else if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 16)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 16;
    }else if (_c == QMetaObject::ReadProperty || _c == QMetaObject::WriteProperty
            || _c == QMetaObject::ResetProperty || _c == QMetaObject::BindableProperty
            || _c == QMetaObject::RegisterPropertyMetaType) {
        qt_static_metacall(this, _c, _id, _a);
        _id -= 5;
    }
    return _id;
}

// SIGNAL 0
void MediaPlayerEngine::mediaPathChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 0, nullptr);
}

// SIGNAL 1
void MediaPlayerEngine::durationChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 1, nullptr);
}

// SIGNAL 2
void MediaPlayerEngine::positionChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 2, nullptr);
}

// SIGNAL 3
void MediaPlayerEngine::isPlayingChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 3, nullptr);
}

// SIGNAL 4
void MediaPlayerEngine::volumeChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 4, nullptr);
}

// SIGNAL 5
void MediaPlayerEngine::frameReady(const QImage & _t1)
{
    void *_a[] = { nullptr, const_cast<void*>(reinterpret_cast<const void*>(std::addressof(_t1))) };
    QMetaObject::activate(this, &staticMetaObject, 5, _a);
}

// SIGNAL 6
void MediaPlayerEngine::mediaLoaded(bool _t1, const QString & _t2)
{
    void *_a[] = { nullptr, const_cast<void*>(reinterpret_cast<const void*>(std::addressof(_t1))), const_cast<void*>(reinterpret_cast<const void*>(std::addressof(_t2))) };
    QMetaObject::activate(this, &staticMetaObject, 6, _a);
}

// SIGNAL 7
void MediaPlayerEngine::errorOccurred(const QString & _t1)
{
    void *_a[] = { nullptr, const_cast<void*>(reinterpret_cast<const void*>(std::addressof(_t1))) };
    QMetaObject::activate(this, &staticMetaObject, 7, _a);
}
QT_WARNING_POP
