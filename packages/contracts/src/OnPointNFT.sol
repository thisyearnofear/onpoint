// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "erc721a/contracts/ERC721A.sol";

/**
 * @title OnPointNFT
 * @notice ERC-721A NFT for OnPoint AI Stylist — minted looks, outfits, and style moments.
 * @dev Supports ERC-2981 royalties, payable mints, and batch minting.
 */
contract OnPointNFT is ERC721A, ERC2981, Ownable {
    /// @notice Base URI for token metadata (IPFS gateway)
    string private _baseTokenURI;

    /// @notice Mint price in wei (set to 0 for free mints)
    uint256 public mintPrice;

    /// @notice Maximum supply (0 = unlimited)
    uint256 public maxSupply;

    /// @notice Whether the contract is paused
    bool public paused;

    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event BaseURIUpdated(string oldUri, string newUri);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_,
        uint256 mintPrice_,
        uint256 maxSupply_,
        address royaltyReceiver_,
        uint96 royaltyBps_
    ) ERC721A(name_, symbol_) Ownable(msg.sender) {
        _baseTokenURI = baseTokenURI_;
        mintPrice = mintPrice_;
        maxSupply = maxSupply_;

        // Set default royalty (ERC-2981)
        if (royaltyReceiver_ != address(0) && royaltyBps_ > 0) {
            _setDefaultRoyalty(royaltyReceiver_, royaltyBps_);
        }
    }

    // ============================================================
    // Minting
    // ============================================================

    /**
     * @notice Mint a single token
     * @param to Recipient address
     * @param uri Token-specific metadata URI (stored in _tokenURIs mapping)
     * @return tokenId The minted token ID
     */
    function mint(address to, string calldata uri) external payable returns (uint256 tokenId) {
        require(!paused, "OnPointNFT: paused");
        require(msg.value >= mintPrice, "OnPointNFT: insufficient payment");
        require(maxSupply == 0 || _totalMinted() < maxSupply, "OnPointNFT: max supply reached");

        tokenId = _nextTokenId();
        _safeMint(to, 1);
        _setTokenURI(tokenId, uri);
    }

    /**
     * @notice Mint with per-token royalty override (ERC-2981)
     * @param to Recipient address
     * @param uri Token-specific metadata URI
     * @param royaltyRecipient Address to receive royalties for this token
     * @param royaltyBps Royalty basis points (e.g., 500 = 5%)
     * @return tokenId The minted token ID
     */
    function mintWithRoyalty(
        address to,
        string calldata uri,
        address royaltyRecipient,
        uint96 royaltyBps
    ) external payable returns (uint256 tokenId) {
        require(!paused, "OnPointNFT: paused");
        require(msg.value >= mintPrice, "OnPointNFT: insufficient payment");
        require(maxSupply == 0 || _totalMinted() < maxSupply, "OnPointNFT: max supply reached");

        tokenId = _nextTokenId();
        _safeMint(to, 1);
        _setTokenURI(tokenId, uri);

        // Set per-token royalty override
        if (royaltyRecipient != address(0) && royaltyBps > 0) {
            _setTokenRoyalty(tokenId, royaltyRecipient, royaltyBps);
        }
    }

    /**
     * @notice Batch mint multiple tokens to the same recipient
     * @param to Recipient address
     * @param uris Array of token-specific metadata URIs
     * @return firstTokenId The ID of the first minted token
     */
    function mintBatch(
        address to,
        string[] calldata uris
    ) external payable returns (uint256 firstTokenId) {
        require(!paused, "OnPointNFT: paused");
        require(uris.length > 0, "OnPointNFT: empty batch");
        require(msg.value >= mintPrice * uris.length, "OnPointNFT: insufficient payment");
        require(
            maxSupply == 0 || _totalMinted() + uris.length <= maxSupply,
            "OnPointNFT: max supply exceeded"
        );

        firstTokenId = _nextTokenId();
        _safeMint(to, uris.length);

        for (uint256 i = 0; i < uris.length; i++) {
            _setTokenURI(firstTokenId + i, uris[i]);
        }
    }

    // ============================================================
    // Token URI Storage (per-token URIs)
    // ============================================================

    mapping(uint256 => string) private _tokenURIs;

    function _setTokenURI(uint256 tokenId, string memory uri) internal {
        _tokenURIs[tokenId] = uri;
    }

    /**
     * @notice Returns the metadata URI for a specific token
     */
    function tokenURI(uint256 tokenId) public view override(ERC721A) returns (string memory) {
        require(_exists(tokenId), "OnPointNFT: URI query for nonexistent token");

        string memory _tokenURI = _tokenURIs[tokenId];

        // If per-token URI is set, return it
        if (bytes(_tokenURI).length > 0) {
            return _tokenURI;
        }

        // Fallback to base URI + tokenId
        string memory base = _baseTokenURI;
        return bytes(base).length > 0
            ? string(abi.encodePacked(base, _toString(tokenId)))
            : "";
    }

    // ============================================================
    // Admin
    // ============================================================

    function setMintPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(oldPrice, newPrice);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        string memory oldUri = _baseTokenURI;
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(oldUri, newBaseURI);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "OnPointNFT: no balance");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "OnPointNFT: withdraw failed");
    }

    // ============================================================
    // Overrides
    // ============================================================

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721A, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
