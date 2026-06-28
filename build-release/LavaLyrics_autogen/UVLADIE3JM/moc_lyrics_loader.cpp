/****************************************************************************
** Meta object code from reading C++ file 'lyrics_loader.h'
**
** Created by: The Qt Meta Object Compiler version 68 (Qt 6.7.2)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../src/lyrics_loader.h"
#include <QtCore/qmetatype.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'lyrics_loader.h' doesn't include <QObject>."
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
struct qt_meta_stringdata_CLASSLyricsLoaderENDCLASS_t {};
constexpr auto qt_meta_stringdata_CLASSLyricsLoaderENDCLASS = QtMocHelpers::stringData(
    "LyricsLoader",
    "lyricsPathChanged",
    "",
    "currentLineChanged",
    "loadLrc",
    "path",
    "loadJson",
    "getAllLines",
    "updateTime",
    "masterTimeSeconds",
    "clear",
    "lyricsPath",
    "currentLine",
    "prevLine",
    "nextLine",
    "currentIndex",
    "isLoaded"
);
#else  // !QT_MOC_HAS_STRINGDATA
#error "qtmochelpers.h not found or too old."
#endif // !QT_MOC_HAS_STRINGDATA
} // unnamed namespace

Q_CONSTINIT static const uint qt_meta_data_CLASSLyricsLoaderENDCLASS[] = {

 // content:
      12,       // revision
       0,       // classname
       0,    0, // classinfo
       7,   14, // methods
       6,   69, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       2,       // signalCount

 // signals: name, argc, parameters, tag, flags, initial metatype offsets
       1,    0,   56,    2, 0x06,    7 /* Public */,
       3,    0,   57,    2, 0x06,    8 /* Public */,

 // methods: name, argc, parameters, tag, flags, initial metatype offsets
       4,    1,   58,    2, 0x02,    9 /* Public */,
       6,    1,   61,    2, 0x02,   11 /* Public */,
       7,    0,   64,    2, 0x102,   13 /* Public | MethodIsConst  */,
       8,    1,   65,    2, 0x02,   14 /* Public */,
      10,    0,   68,    2, 0x02,   16 /* Public */,

 // signals: parameters
    QMetaType::Void,
    QMetaType::Void,

 // methods: parameters
    QMetaType::Bool, QMetaType::QString,    5,
    QMetaType::Bool, QMetaType::QString,    5,
    QMetaType::QVariantList,
    QMetaType::Void, QMetaType::Double,    9,
    QMetaType::Void,

 // properties: name, type, flags
      11, QMetaType::QString, 0x00015103, uint(0), 0,
      12, QMetaType::QString, 0x00015001, uint(1), 0,
      13, QMetaType::QString, 0x00015001, uint(1), 0,
      14, QMetaType::QString, 0x00015001, uint(1), 0,
      15, QMetaType::Int, 0x00015001, uint(1), 0,
      16, QMetaType::Bool, 0x00015001, uint(0), 0,

       0        // eod
};

Q_CONSTINIT const QMetaObject LyricsLoader::staticMetaObject = { {
    QMetaObject::SuperData::link<QObject::staticMetaObject>(),
    qt_meta_stringdata_CLASSLyricsLoaderENDCLASS.offsetsAndSizes,
    qt_meta_data_CLASSLyricsLoaderENDCLASS,
    qt_static_metacall,
    nullptr,
    qt_incomplete_metaTypeArray<qt_meta_stringdata_CLASSLyricsLoaderENDCLASS_t,
        // property 'lyricsPath'
        QtPrivate::TypeAndForceComplete<QString, std::true_type>,
        // property 'currentLine'
        QtPrivate::TypeAndForceComplete<QString, std::true_type>,
        // property 'prevLine'
        QtPrivate::TypeAndForceComplete<QString, std::true_type>,
        // property 'nextLine'
        QtPrivate::TypeAndForceComplete<QString, std::true_type>,
        // property 'currentIndex'
        QtPrivate::TypeAndForceComplete<int, std::true_type>,
        // property 'isLoaded'
        QtPrivate::TypeAndForceComplete<bool, std::true_type>,
        // Q_OBJECT / Q_GADGET
        QtPrivate::TypeAndForceComplete<LyricsLoader, std::true_type>,
        // method 'lyricsPathChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'currentLineChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'loadLrc'
        QtPrivate::TypeAndForceComplete<bool, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        // method 'loadJson'
        QtPrivate::TypeAndForceComplete<bool, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        // method 'getAllLines'
        QtPrivate::TypeAndForceComplete<QVariantList, std::false_type>,
        // method 'updateTime'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<double, std::false_type>,
        // method 'clear'
        QtPrivate::TypeAndForceComplete<void, std::false_type>
    >,
    nullptr
} };

void LyricsLoader::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    if (_c == QMetaObject::InvokeMetaMethod) {
        auto *_t = static_cast<LyricsLoader *>(_o);
        (void)_t;
        switch (_id) {
        case 0: _t->lyricsPathChanged(); break;
        case 1: _t->currentLineChanged(); break;
        case 2: { bool _r = _t->loadLrc((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1])));
            if (_a[0]) *reinterpret_cast< bool*>(_a[0]) = std::move(_r); }  break;
        case 3: { bool _r = _t->loadJson((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1])));
            if (_a[0]) *reinterpret_cast< bool*>(_a[0]) = std::move(_r); }  break;
        case 4: { QVariantList _r = _t->getAllLines();
            if (_a[0]) *reinterpret_cast< QVariantList*>(_a[0]) = std::move(_r); }  break;
        case 5: _t->updateTime((*reinterpret_cast< std::add_pointer_t<double>>(_a[1]))); break;
        case 6: _t->clear(); break;
        default: ;
        }
    } else if (_c == QMetaObject::IndexOfMethod) {
        int *result = reinterpret_cast<int *>(_a[0]);
        {
            using _t = void (LyricsLoader::*)();
            if (_t _q_method = &LyricsLoader::lyricsPathChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 0;
                return;
            }
        }
        {
            using _t = void (LyricsLoader::*)();
            if (_t _q_method = &LyricsLoader::currentLineChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 1;
                return;
            }
        }
    } else if (_c == QMetaObject::ReadProperty) {
        auto *_t = static_cast<LyricsLoader *>(_o);
        (void)_t;
        void *_v = _a[0];
        switch (_id) {
        case 0: *reinterpret_cast< QString*>(_v) = _t->lyricsPath(); break;
        case 1: *reinterpret_cast< QString*>(_v) = _t->currentLine(); break;
        case 2: *reinterpret_cast< QString*>(_v) = _t->prevLine(); break;
        case 3: *reinterpret_cast< QString*>(_v) = _t->nextLine(); break;
        case 4: *reinterpret_cast< int*>(_v) = _t->currentIndex(); break;
        case 5: *reinterpret_cast< bool*>(_v) = _t->isLoaded(); break;
        default: break;
        }
    } else if (_c == QMetaObject::WriteProperty) {
        auto *_t = static_cast<LyricsLoader *>(_o);
        (void)_t;
        void *_v = _a[0];
        switch (_id) {
        case 0: _t->setLyricsPath(*reinterpret_cast< QString*>(_v)); break;
        default: break;
        }
    } else if (_c == QMetaObject::ResetProperty) {
    } else if (_c == QMetaObject::BindableProperty) {
    }
}

const QMetaObject *LyricsLoader::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *LyricsLoader::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_meta_stringdata_CLASSLyricsLoaderENDCLASS.stringdata0))
        return static_cast<void*>(this);
    return QObject::qt_metacast(_clname);
}

int LyricsLoader::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QObject::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 7)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 7;
    } else if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 7)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 7;
    }else if (_c == QMetaObject::ReadProperty || _c == QMetaObject::WriteProperty
            || _c == QMetaObject::ResetProperty || _c == QMetaObject::BindableProperty
            || _c == QMetaObject::RegisterPropertyMetaType) {
        qt_static_metacall(this, _c, _id, _a);
        _id -= 6;
    }
    return _id;
}

// SIGNAL 0
void LyricsLoader::lyricsPathChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 0, nullptr);
}

// SIGNAL 1
void LyricsLoader::currentLineChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 1, nullptr);
}
QT_WARNING_POP
