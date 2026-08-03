import { useState } from "react";
import dayjs from "dayjs";
import DeviceSelectionModal from "./DeviceSelectionModal";

const ContractItems = ({ contractItems, contract, loading }) => {
  const [selectedContractItems, setSelectedContractItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [calculatedData, setCalculatedData] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [percentages, setPercentages] = useState({});
  const [fees, setFees] = useState({});
  const [chipFidelities, setChipFidelities] = useState({});
  const [requestDate, setRequestDate] = useState(dayjs().format("YYYY-MM-DD"));

  const getItemFidelity = (item) => {
    const description = item.QbmItemDescription || "";
    const match = description.match(/(\d+)\s*meses?/i);
    if (match) {
      const months = parseInt(match[1]);
      if ([6, 12, 24, 36, 48, 60].includes(months)) {
        return `${months}`;
      }
    }
    return 0;
  };

  const getItemMonthsLeft = (item) => {
    if (item.QbmItemCode.includes("CHIP") || item.QbmItemCode.includes("WEB")) {
      const chipFidelity = chipFidelities[`${item.QbmItemCode}-${item.UnitPrice}`];
      return chipFidelity
        ? {
            totalMonths: chipFidelity,
            display: `${chipFidelity} ${chipFidelity === 1 ? "mês" : "meses"}`,
          }
        : { totalMonths: 0, display: "N/A" };
    } else {
      const itemFidelityValue = parseInt(getItemFidelity(item));
      return itemFidelityValue > 0 ? getMonthsLeft(itemFidelityValue, contract.DocumentDateToGrid) : { totalMonths: 0, display: "N/A" };
    }
  };

  const getMonthsLeft = (fidelity, contractDate) => {
    if (fidelity === 0) return { totalMonths: 0, display: "N/A" };

    const datePart = contractDate.split(" ")[0]; // Isso aqui ta sendo feito pq o contractDate vem com hora junto
    const [day, month, year] = datePart.split("/");
    const contractStart = dayjs(`${year}-${month}-${day}`);

    const contractEnd = contractStart.add(fidelity, "month");
    // console.log("-----------------------");

    const cancelDate = getCancelDate();
    const referenceDate = dayjs(cancelDate);

    // console.log("Data início:", contractStart.format("DD/MM/YYYY"));
    // console.log("Data fim:", contractEnd.format("DD/MM/YYYY"));
    // console.log("Data referência (cancelamento):", referenceDate.format("DD/MM/YYYY"));

    if (contractEnd.isBefore(referenceDate) || contractEnd.isSame(referenceDate)) {
      return { totalMonths: 0, display: "N/A" };
    }

    const diffInMonths = contractEnd.diff(referenceDate, "month");
    const remainingAfterMonths = referenceDate.add(diffInMonths, "month");
    const diffInDays = contractEnd.diff(remainingAfterMonths, "day");

    const totalMonths = diffInDays > 0 ? diffInMonths + 1 : diffInMonths;

    // console.log(`Restam: ${diffInMonths} meses e ${diffInDays} dias`);
    // console.log(`Meses para cálculo da multa: ${totalMonths}`);

    let display = "";
    if (totalMonths > 0) {
      display = `${totalMonths} ${totalMonths === 1 ? "mês" : "meses"}`;
    } else {
      display = "N/A";
    }

    return {
      totalMonths: totalMonths,
      display: display,
    };
  };

  const getCancelDate = () => {
    let cancelDate = dayjs(requestDate, "YYYY-MM-DD");

    if (localStorage.getItem("sector") === "CS") {
      // Antes estava como 'cancelDate.add(1, "month");', mas ao falar com o Vitor mudei para adicionar 30 dias mesmo.
      cancelDate = cancelDate.add(30, "days");
    }
    return cancelDate;
  };

  const handleCheckboxChange = (e, item) => {
    if (e.target.checked) {
      setSelectedContractItems([...selectedContractItems, item]);
    } else {
      setSelectedContractItems(selectedContractItems.filter((i) => i !== item));
    }
  };

  const handleClick = () => {
    setRequestDate(dayjs().format("YYYY-MM-DD"));
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setQuantities({});
    setPercentages({});
    setFees({});
    setChipFidelities({});
  };

  const handleNext = () => {
    const calculatedData = selectedContractItems.map((item) => {
      const itemId = `${item.QbmItemCode}-${item.UnitPrice}`;
      const itemMonthsLeft = getItemMonthsLeft(item);
      const quantity = quantities[itemId] ?? item.Quantity;
      const percentage = percentages[itemId] ?? 50;
      const fee = fees[itemId] ?? 300;
      const fine = calculateFine(item, itemId, itemMonthsLeft);
      const total = calculateTotal(item, itemId, itemMonthsLeft);

      return {
        ...item,
        itemId,
        quantity,
        percentage,
        fee,
        fine,
        total,
        fidelityDisplay: itemMonthsLeft.display,
        finePerUnit: fine / quantity,
      };
    });

    setCalculatedData(calculatedData);
    setShowModal(false);
    setShowDeviceModal(true);
  };

  const handleDeviceModalClose = () => {
    setShowDeviceModal(false);
    setShowModal(true);
  };

  const handleQuantityChange = (itemId, value) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: parseInt(value) || 0,
    }));
  };

  const handlePercentageChange = (itemId, value) => {
    setPercentages((prev) => ({
      ...prev,
      [itemId]: parseFloat(value) || 0,
    }));
  };

  const handleFeeChange = (itemId, value) => {
    setFees((prev) => ({
      ...prev,
      [itemId]: parseFloat(value) || 0,
    }));
  };

  const handleChipFidelityChange = (itemId, value) => {
    setChipFidelities((prev) => ({
      ...prev,
      [itemId]: parseInt(value) || 0,
    }));
  };

  const getAvailableFidelities = () => {
    const fidelities = new Set();

    selectedContractItems.forEach((item) => {
      if (!item.QbmItemCode.includes("CHIP") || item.QbmItemCode.includes("WEB")) {
        const itemFidelityValue = parseInt(getItemFidelity(item));
        if (itemFidelityValue > 0) {
          const itemMonthsLeft = getMonthsLeft(itemFidelityValue, contract.DocumentDateToGrid);
          if (itemMonthsLeft.totalMonths > 0) {
            fidelities.add(
              JSON.stringify({
                value: itemMonthsLeft.totalMonths,
                display: itemMonthsLeft.display,
              }),
            );
          }
        }
      }
    });

    return Array.from(fidelities).map((f) => JSON.parse(f));
  };

  const calculateNetValue = (item, itemId) => {
    const quantity = quantities[itemId] ?? item.Quantity;
    return quantity * item.UnitPrice;
  };

  const calculateFine = (item, itemId, monthsLeftData) => {
    const netValue = calculateNetValue(item, itemId);
    const percentage = percentages[itemId] ?? 50;
    const totalMonths = monthsLeftData.totalMonths;
    return totalMonths * netValue * (percentage / 100);
  };

  const calculateTotal = (item, itemId, monthsLeftData) => {
    const fine = calculateFine(item, itemId, monthsLeftData);
    const fee = fees[itemId] ?? 300;
    const quantity = quantities[itemId] ?? item.Quantity;

    const totalFee = fee * quantity;

    return fine + totalFee;
  };

  return (
    <div>
      <table className="table table-bordered table-hover" style={{ fontSize: "0.8rem" }}>
        <thead>
          <tr>
            <th></th>
            <th>Itens do Contrato</th>
            <th>QNT</th>
            <th>Pr. Unit.</th>
            <th>Desconto</th>
            <th>Val. Líquido</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan="12">Carregando itens...</td>
            </tr>
          ) : (
            contractItems &&
            contractItems.map((item, index) => (
              <tr key={index}>
                <td style={{ width: "5px" }}>{item.IsEnabled === true ? <div className="green-circle"></div> : <div className="red-circle"></div>}</td>
                <td>
                  <div className="row ps-3">{item.QbmItemCode}:</div>
                  <div className="row ps-3">{item.QbmItemDescription}</div>
                </td>
                <td style={{ width: "10px" }}>{item.Quantity}</td>
                <td style={{ width: "100px" }}>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.UnitPrice)}</td>
                <td style={{ width: "10px" }}>{item.Discount}%</td>
                <td>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.NetValue)}</td>
                <td style={{ width: "5px" }}>
                  <input type="checkbox" name={`checkbox-${index}`} id={`checkbox-${index}`} onChange={(e) => handleCheckboxChange(e, item)} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button className="btn btn-sm btn-qorange float-end" onClick={handleClick}>
        Memorial de Cobrança
      </button>

      {showModal && (
        <>
          <div className="modal-backdrop fade show"></div>

          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Memorial de Cobrança - Contrato: {contract.QbmDocumentId}</h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <div className="modal-body">
                  <p>
                    <strong>Data do Contrato:</strong> {contract.DocumentDateToGrid.split(" ")[0]}
                  </p>
                  <div className="mb-3">
                    <strong>Data da Solicitação:</strong>{" "}
                    <input type="date" name="requestDate" id="requestDate" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />{" "}
                    <strong>Data de Encerramento:</strong> {getCancelDate().format("DD/MM/YYYY")}{" "}
                    {requestDate !== dayjs().format("YYYY-MM-DD") ? (
                      <p className="ps-1 mb-0 mt-1 animated-background text-center">
                        <strong>Atenção:</strong> Alterar a data de solicitação irá modificar o cálculo da multa. Tenha certeza do que <strong>você</strong>{" "}
                        está fazendo.
                      </p>
                    ) : null}
                  </div>

                  {selectedContractItems.length > 0 && (
                    <div>
                      <table className="table table-sm table-bordered table-hover">
                        <thead>
                          <tr>
                            <th></th>
                            <th>
                              <p className="m-0 p-0">Itens do Contrato</p>
                            </th>
                            <th>
                              <p className="m-0 p-0">QNT</p>
                            </th>
                            <th>
                              <p className="m-0 p-0">Pr. Unit.</p>
                            </th>
                            <th>
                              <p className="m-0 p-0">Fidelidade Restante</p>
                            </th>
                            <th>
                              <p className="m-0 p-0 link-qorange" title={import.meta.env.VITE_TITLE_MULTA}>
                                Multa Contratual (%)
                              </p>
                            </th>
                            <th>
                              <p className="m-0 p-0">Multa</p>
                            </th>
                            <th>
                              <p className="m-0 p-0 link-qorange" title={import.meta.env.VITE_TITLE_TAXA_FINALIZACAO}>
                                Taxa de Finalização
                              </p>
                            </th>
                            <th>
                              <p className="m-0 p-0">Total</p>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedContractItems.map((item) => {
                            const itemId = `${item.QbmItemCode}-${item.UnitPrice}`;
                            const itemMonthsLeft = getItemMonthsLeft(item);

                            return (
                              <tr key={itemId}>
                                <td style={{ width: "5px" }}>
                                  {item.IsEnabled === true ? <div className="green-circle"></div> : <div className="red-circle"></div>}
                                </td>
                                <td>
                                  <div className="row ps-3">{item.QbmItemCode}:</div>
                                  <div className="row ps-3" style={{ fontSize: "0.8rem", maxWidth: "400px" }}>
                                    {item.QbmItemDescription}
                                    {item.IsEnabled === false && <span className=" m-0 p-0 text-danger">(Esse item está inativo!)</span>}
                                  </div>
                                </td>
                                <td style={{ width: "10px" }}>
                                  <input
                                    className="form-control form-control-sm"
                                    type="number"
                                    value={quantities[itemId] || item.Quantity}
                                    onChange={(e) => handleQuantityChange(itemId, e.target.value)}
                                    min="0"
                                    style={{ width: "60px" }}
                                  />
                                </td>
                                <td style={{ width: "100px" }}>
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.UnitPrice)}
                                </td>
                                <td>
                                  {item.QbmItemCode.includes("CHIP") || item.QbmItemCode.includes("WEB") ? (
                                    <select
                                      className="form-select form-select-sm"
                                      value={chipFidelities[itemId] || ""}
                                      onChange={(e) => handleChipFidelityChange(itemId, e.target.value)}>
                                      <option value="N/A">N/A</option>
                                      {getAvailableFidelities().map((fidelity) => (
                                        <option key={fidelity.value} value={fidelity.value}>
                                          {fidelity.display}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    itemMonthsLeft.display
                                  )}
                                </td>
                                <td>
                                  <input
                                    className="form-control form-control-sm"
                                    type="number"
                                    value={percentages[itemId] ?? 50}
                                    onChange={(e) => handlePercentageChange(itemId, e.target.value)}
                                    style={{ width: "60px" }}
                                  />
                                </td>
                                <td>
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(calculateFine(item, itemId, itemMonthsLeft))}
                                </td>
                                <td>
                                  <select
                                    className="form-select form-select-sm"
                                    value={fees[itemId] ?? 300}
                                    onChange={(e) => handleFeeChange(itemId, e.target.value)}>
                                    <option value={0}>R$ 0,00</option>
                                    <option value={300}>R$ 300,00</option>
                                    <option value={500}>R$ 500,00</option>
                                  </select>
                                </td>
                                <td>
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(calculateTotal(item, itemId, itemMonthsLeft))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedContractItems.length === 0 && <div className="alert alert-warning">Nenhum item selecionado para o memorial.</div>}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={closeModal}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-sm btn-qorange" disabled={selectedContractItems.length === 0} onClick={(e) => handleNext()}>
                    Próximo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <DeviceSelectionModal
        show={showDeviceModal}
        onClose={handleDeviceModalClose}
        calculatedData={calculatedData}
        contract={contract}
        requestDate={requestDate}
        getCancelDate={getCancelDate}
      />
    </div>
  );
};

export default ContractItems;
