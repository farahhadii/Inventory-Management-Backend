const asyncHandler = require("express-async-handler");
const cloudinary = require("cloudinary").v2;
const Product = require("../models/productModel");
const { fileSizeFormatter } = require("../utils/fileUpload");

const uploadImage = async (file) => {
  try {
    const uploadedFile = await cloudinary.uploader.upload(file.path, {
      folder: "Inventory Management App",
      resource_type: "image",
    });

    return {
      fileName: file.originalname,
      filePath: uploadedFile.secure_url,
      fileType: file.mimetype,
      fileSize: fileSizeFormatter(file.size, 2),
    };
  } catch (error) {
    throw new Error("Image could not be uploaded");
  }
};

const verifyOwnership = (product, userId) => {
  if (!product) {
    const error = new Error("Product not found");
    error.status = 404;
    throw error;
  }

  if (product.user.toString() !== userId.toString()) {
    const error = new Error("User not authorized");
    error.status = 401;
    throw error;
  }
};

// Create Product
const createProduct = asyncHandler(async (req, res) => {
  const { name, sku, category, quantity, price, description } = req.body;

  if (!name || !category || !quantity || !price) {
    res.status(400);
    throw new Error("Please fill in all fields");
  }

  // Handle Image Upload
  const image = req.file ? await uploadImage(req.file) : {};

  // Create Product in the database
  const product = await Product.create({
    user: req.user._id,
    name,
    sku,
    quantity,
    category,
    price,
    description: description || "",
    image,
  });

  res.status(201).json(product);
});

// Get All Products for a User
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ user: req.user.id }).sort("-createdAt");
  res.status(200).json(products);
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  verifyOwnership(product, req.user._id);

  res.status(200).json(product);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  verifyOwnership(product, req.user._id);

  if (product.image && product.image.filePath) {
    const publicId = product.image.filePath.split("/").pop().split(".")[0];
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error("Error deleting image from Cloudinary:", error);
    }
  }

  await Product.findByIdAndDelete(req.params.id);

  res.status(200).json({ id: req.params.id, message: "Product removed" });
});

// Update Product
const updateProduct = asyncHandler(async (req, res) => {
  const { name, category, quantity, price, description } = req.body;
  const { id } = req.params;

  const product = await Product.findById(id);

  verifyOwnership(product, req.user._id);

  const image = req.file ? await uploadImage(req.file) : product.image;
  const updatedProduct = await Product.findByIdAndUpdate(
    id,
    {
      name,
      category,
      quantity,
      price,
      description: description || "",
      image,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json(updatedProduct);
});

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  deleteProduct,
  updateProduct,
};
