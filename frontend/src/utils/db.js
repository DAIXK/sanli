const DB_NAME = 'SanliModelDB'
const DB_VERSION = 1
const STORE_NAME = 'models'

const openDB = () => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB not supported'))
            return
        }
        const request = window.indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = (event) => {
            reject(new Error('Database error: ' + event.target.error))
        }

        request.onsuccess = (event) => {
            resolve(event.target.result)
        }

        request.onupgradeneeded = (event) => {
            const db = event.target.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME)
            }
        }
    })
}

export const saveModelToDB = async (key, data) => {
    try {
        const db = await openDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.put(data, key)

            request.onsuccess = () => resolve(true)
            request.onerror = (event) => reject(event.target.error)
        })
    } catch (error) {
        console.error('IndexedDB save failed:', error)
        return false
    }
}

export const loadModelFromDB = async (key) => {
    try {
        const db = await openDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.get(key)

            request.onsuccess = (event) => resolve(event.target.result)
            request.onerror = (event) => reject(event.target.error)
        })
    } catch (error) {
        console.error('IndexedDB load failed:', error)
        return null
    }
}
