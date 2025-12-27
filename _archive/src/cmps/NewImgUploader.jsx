import React, { useState } from "react"
import { UploadButton } from "@bytescale/upload-widget-react"

const UploadButtonComponent = ({ onComplete }) => {
  const options = {
    apiKey: "free",
    editor: {
      images: {
        crop: false, // Disable cropping
        preview: true,
        sizing: "contain", // Adjust the sizing option as needed (e.g., contain, cover)
      },
    },
    layout: "modal",
    maxFileCount: 1,
    maxFileSizeBytes: 10485760,
    // ... other options
  }

  const [uploadedFiles, setUploadedFiles] = useState([])

  const handleUploadComplete = (files) => {
    setUploadedFiles(files)
    onComplete(files.map((file) => file.fileUrl))
  }

  return (
    <div className="flex align-center">
      <UploadButton options={options} onComplete={handleUploadComplete}>
        {({ onClick }) => (
          <button onClick={onClick} className="img-upload-btn">
            Upload a file...
          </button>
        )}
      </UploadButton>

      {/* Display the uploaded file URLs */}
      {uploadedFiles.map((file, index) => (
        <img key={index} src={file.fileUrl} 
        style={{ marginInlineStart: ".5rem"}}
        className="uploaded-img" />
      ))}
    </div>
  )
}

export default UploadButtonComponent
