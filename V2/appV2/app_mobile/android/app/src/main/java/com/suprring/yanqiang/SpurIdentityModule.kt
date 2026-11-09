package com.suprring.yanqiang

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyStore
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Stores device bearer credentials encrypted by a non-exportable Android Keystore key. */
class SpurIdentityModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "SpurIdentity"

  private val preferences = context.getSharedPreferences("spur_identity_v1", Context.MODE_PRIVATE)
  private val keyAlias = "com.suprring.identity.aes.v1"

  private fun encryptionKey(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(keyAlias, null) as? SecretKey)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
      KeyGenParameterSpec.Builder(
        keyAlias,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .build(),
    )
    return generator.generateKey()
  }

  private fun preferenceKey(scope: String): String =
    MessageDigest.getInstance("SHA-256")
      .digest(scope.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }

  @ReactMethod
  fun read(scope: String, promise: Promise) {
    try {
      if (scope.isBlank() || scope.length > 512) throw IllegalArgumentException("Invalid secure scope")
      val stored = preferences.getString(preferenceKey(scope), null)
      if (stored == null) {
        promise.resolve(null)
        return
      }
      val bytes = Base64.decode(stored, Base64.NO_WRAP)
      if (bytes.size <= 12) throw IllegalStateException("Invalid secure value")
      val iv = bytes.copyOfRange(0, 12)
      val ciphertext = bytes.copyOfRange(12, bytes.size)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), GCMParameterSpec(128, iv))
      promise.resolve(String(cipher.doFinal(ciphertext), Charsets.UTF_8))
    } catch (error: Exception) {
      promise.reject("KEYSTORE_READ", "安全凭据暂时无法读取，已停止执行", error)
    }
  }

  @ReactMethod
  fun write(scope: String, value: String, promise: Promise) {
    try {
      if (scope.isBlank() || scope.length > 512 || value.toByteArray(Charsets.UTF_8).size >= 1_000_000) {
        throw IllegalArgumentException("Invalid secure value")
      }
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, encryptionKey())
      val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
      val stored = Base64.encodeToString(cipher.iv + ciphertext, Base64.NO_WRAP)
      val saved = preferences.edit().putString(preferenceKey(scope), stored).commit()
      if (!saved) throw IllegalStateException("Secure value was not persisted")
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("KEYSTORE_WRITE", "安全凭据未保存，操作已停止", error)
    }
  }

  @ReactMethod
  fun newId(promise: Promise) {
    promise.resolve(UUID.randomUUID().toString().lowercase())
  }
}
