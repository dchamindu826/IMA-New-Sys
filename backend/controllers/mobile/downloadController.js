const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDownloadRecording = async (req, res) => {
    try {
        const { zoomId } = req.params;

        // Zoom ID එකෙන් Database එකේ තියෙන Recording එක හොයාගන්නවා
        const recording = await prisma.recordings.findFirst({
            where: { zoomMeetingId: zoomId }
        });

        if (!recording || !recording.link) {
            return res.status(404).json({ message: "Recording not found or unavailable for offline download." });
        }

        res.status(200).json({
            download_url: recording.link, // Video එක තියෙන ඇත්ත ලින්ක් එක (AWS / S3 / Server Path)
            file_size: recording.file_size || 50000000 // Size එක Bytes වලින් (50MB වගේ)
        });
    } catch (error) {
        console.error("Download Link Error:", error);
        res.status(500).json({ message: "Failed to generate download link" });
    }
};

module.exports = { getDownloadRecording };