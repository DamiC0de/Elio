/**
 * DivaKeyboard - Custom iOS Keyboard Extension
 * 
 * A voice-powered keyboard that uses Diva AI to transcribe and reformulate
 * spoken messages before inserting them into any text field.
 */

import UIKit
import AVFoundation
import Speech

class KeyboardViewController: UIInputViewController {
    
    // MARK: - Properties
    
    private var micButton: UIButton!
    private var textPreview: UILabel!
    private var statusLabel: UILabel!
    private var isRecording = false
    private var audioRecorder: AVAudioRecorder?
    private var recordedAudioURL: URL?
    
    // Server configuration
    private let serverURL = "https://72.60.155.227:3001"
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        requestPermissions()
    }
    
    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        // Keyboard height
        let heightConstraint = view.heightAnchor.constraint(equalToConstant: 260)
        heightConstraint.priority = .defaultHigh
        heightConstraint.isActive = true
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        view.backgroundColor = UIColor(red: 0.12, green: 0.12, blue: 0.14, alpha: 1.0)
        
        // Status label
        statusLabel = UILabel()
        statusLabel.text = "Appuie sur le micro pour parler"
        statusLabel.textColor = .lightGray
        statusLabel.textAlignment = .center
        statusLabel.font = .systemFont(ofSize: 14)
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusLabel)
        
        // Text preview
        textPreview = UILabel()
        textPreview.text = ""
        textPreview.textColor = .white
        textPreview.textAlignment = .center
        textPreview.font = .systemFont(ofSize: 16, weight: .medium)
        textPreview.numberOfLines = 3
        textPreview.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(textPreview)
        
        // Mic button
        micButton = UIButton(type: .system)
        micButton.setImage(UIImage(systemName: "mic.fill"), for: .normal)
        micButton.tintColor = .white
        micButton.backgroundColor = UIColor(red: 0.4, green: 0.3, blue: 0.9, alpha: 1.0)
        micButton.layer.cornerRadius = 35
        micButton.translatesAutoresizingMaskIntoConstraints = false
        micButton.addTarget(self, action: #selector(micButtonTapped), for: .touchUpInside)
        view.addSubview(micButton)
        
        // Globe button (switch keyboard)
        let globeButton = UIButton(type: .system)
        globeButton.setImage(UIImage(systemName: "globe"), for: .normal)
        globeButton.tintColor = .lightGray
        globeButton.translatesAutoresizingMaskIntoConstraints = false
        globeButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
        view.addSubview(globeButton)
        
        // Backspace button
        let backspaceButton = UIButton(type: .system)
        backspaceButton.setImage(UIImage(systemName: "delete.left"), for: .normal)
        backspaceButton.tintColor = .lightGray
        backspaceButton.translatesAutoresizingMaskIntoConstraints = false
        backspaceButton.addTarget(self, action: #selector(backspaceTapped), for: .touchUpInside)
        view.addSubview(backspaceButton)
        
        // Return button
        let returnButton = UIButton(type: .system)
        returnButton.setTitle("Envoyer", for: .normal)
        returnButton.tintColor = .white
        returnButton.backgroundColor = UIColor(red: 0.2, green: 0.6, blue: 0.4, alpha: 1.0)
        returnButton.layer.cornerRadius = 8
        returnButton.translatesAutoresizingMaskIntoConstraints = false
        returnButton.addTarget(self, action: #selector(returnTapped), for: .touchUpInside)
        view.addSubview(returnButton)
        
        // Constraints
        NSLayoutConstraint.activate([
            statusLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            
            textPreview.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 8),
            textPreview.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            textPreview.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            textPreview.heightAnchor.constraint(equalToConstant: 60),
            
            micButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            micButton.topAnchor.constraint(equalTo: textPreview.bottomAnchor, constant: 16),
            micButton.widthAnchor.constraint(equalToConstant: 70),
            micButton.heightAnchor.constraint(equalToConstant: 70),
            
            globeButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            globeButton.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -16),
            globeButton.widthAnchor.constraint(equalToConstant: 44),
            globeButton.heightAnchor.constraint(equalToConstant: 44),
            
            backspaceButton.trailingAnchor.constraint(equalTo: returnButton.leadingAnchor, constant: -8),
            backspaceButton.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -16),
            backspaceButton.widthAnchor.constraint(equalToConstant: 44),
            backspaceButton.heightAnchor.constraint(equalToConstant: 44),
            
            returnButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            returnButton.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -16),
            returnButton.widthAnchor.constraint(equalToConstant: 80),
            returnButton.heightAnchor.constraint(equalToConstant: 44),
        ])
    }
    
    // MARK: - Permissions
    
    private func requestPermissions() {
        // Request microphone permission
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
            DispatchQueue.main.async {
                if !granted {
                    self?.statusLabel.text = "⚠️ Micro non autorisé"
                }
            }
        }
        
        // Request speech recognition permission
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                if status != .authorized {
                    self?.statusLabel.text = "⚠️ Reconnaissance vocale non autorisée"
                }
            }
        }
    }
    
    // MARK: - Actions
    
    @objc private func micButtonTapped() {
        if isRecording {
            stopRecording()
        } else {
            startRecording()
        }
    }
    
    @objc private func backspaceTapped() {
        textDocumentProxy.deleteBackward()
    }
    
    @objc private func returnTapped() {
        textDocumentProxy.insertText("\n")
    }
    
    // MARK: - Recording
    
    private func startRecording() {
        let audioSession = AVAudioSession.sharedInstance()
        
        do {
            try audioSession.setCategory(.record, mode: .default)
            try audioSession.setActive(true)
            
            let documentsPath = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.diva.app")!
            let audioFilename = documentsPath.appendingPathComponent("recording.m4a")
            recordedAudioURL = audioFilename
            
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 16000,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
            ]
            
            audioRecorder = try AVAudioRecorder(url: audioFilename, settings: settings)
            audioRecorder?.record()
            
            isRecording = true
            micButton.backgroundColor = .red
            micButton.setImage(UIImage(systemName: "stop.fill"), for: .normal)
            statusLabel.text = "🎤 Écoute en cours..."
            textPreview.text = ""
            
        } catch {
            statusLabel.text = "❌ Erreur: \(error.localizedDescription)"
        }
    }
    
    private func stopRecording() {
        audioRecorder?.stop()
        isRecording = false
        micButton.backgroundColor = UIColor(red: 0.4, green: 0.3, blue: 0.9, alpha: 1.0)
        micButton.setImage(UIImage(systemName: "mic.fill"), for: .normal)
        statusLabel.text = "⏳ Traitement..."
        
        // Send to Diva server
        if let audioURL = recordedAudioURL {
            sendAudioToDiva(audioURL: audioURL)
        }
    }
    
    // MARK: - Network
    
    private func sendAudioToDiva(audioURL: URL) {
        guard let audioData = try? Data(contentsOf: audioURL) else {
            statusLabel.text = "❌ Erreur lecture audio"
            return
        }
        
        // Get auth token from shared keychain
        guard let token = getAuthToken() else {
            statusLabel.text = "❌ Non connecté - ouvre l'app Diva"
            return
        }
        
        let base64Audio = audioData.base64EncodedString()
        
        guard let url = URL(string: "\(serverURL)/api/v1/keyboard/process") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let body: [String: Any] = [
            "audio": base64Audio,
            "format": "m4a"
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    self?.statusLabel.text = "❌ Erreur: \(error.localizedDescription)"
                    return
                }
                
                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let text = json["text"] as? String else {
                    self?.statusLabel.text = "❌ Réponse invalide"
                    return
                }
                
                // Show preview and insert
                self?.textPreview.text = text
                self?.statusLabel.text = "✅ Prêt à insérer"
                self?.textDocumentProxy.insertText(text)
            }
        }.resume()
    }
    
    // MARK: - Keychain
    
    private func getAuthToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.diva.app.auth",
            kSecAttrAccessGroup as String: "group.com.diva.app",
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        if status == errSecSuccess, let data = result as? Data {
            return String(data: data, encoding: .utf8)
        }
        
        return nil
    }
}
